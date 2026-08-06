import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || "https://qredixumhxjcaymwqcec.supabase.co";
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_abgr_qMdFxAOn8IhHpm_PA_GamaQUgF";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const DATA_DIR = path.join(process.cwd(), "data_store");
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (_) {}
}

function getCollectionFilePath(colName: string): string {
  const safeName = colName.replace(/[^a-zA-Z0-9_-]/g, "_");
  return path.join(DATA_DIR, `${safeName}.json`);
}

function readCollectionFile(colName: string): Record<string, any> {
  const filePath = getCollectionFilePath(colName);
  if (!fs.existsSync(filePath)) return {};
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) || {};
  } catch (e) {
    return {};
  }
}

function writeCollectionFile(colName: string, dataMap: Record<string, any>) {
  const filePath = getCollectionFilePath(colName);
  try {
    fs.writeFileSync(filePath, JSON.stringify(dataMap, null, 2), "utf-8");
  } catch (e) {
    console.error(`Error writing collection file ${colName}:`, e);
  }
}

async function getDoc(colName: string, id: string) {
  // Check local file store first
  const fileData = readCollectionFile(colName);
  if (fileData[id]) {
    return { exists: () => true, data: () => fileData[id], id };
  }

  try {
    const { data, error } = await supabase.from(colName).select('*').eq('id', id).maybeSingle();
    if (!error && data) {
      const docData = data.data && typeof data.data === 'object' ? { ...data, ...data.data, id: data.id || id } : data;
      return { exists: () => true, data: () => docData, id };
    }
  } catch (_) {}
  return { exists: () => false, data: () => null, id };
}

async function setDoc(colName: string, id: string, data: any, options?: { merge?: boolean }) {
  let dataToSave = data;
  if (options?.merge) {
    const existing = await getDoc(colName, id);
    if (existing.exists()) {
      dataToSave = { ...existing.data(), ...data };
    }
  }

  // Update file store
  const fileData = readCollectionFile(colName);
  fileData[id] = { ...dataToSave, id };
  writeCollectionFile(colName, fileData);

  // Attempt Supabase
  try {
    const payload = { id, ...dataToSave, data: dataToSave };
    await supabase.from(colName).upsert(payload);
  } catch (_) {}
}

async function getDocs(colName: string) {
  const docsMap = new Map<string, any>();

  // 1. Read file store
  const fileData = readCollectionFile(colName);
  Object.entries(fileData).forEach(([id, item]) => {
    docsMap.set(id, item);
  });

  // 2. Try Supabase
  try {
    const { data, error } = await supabase.from(colName).select('*');
    if (!error && data) {
      data.forEach((row: any) => {
        const rowData = row.data && typeof row.data === 'object' ? { ...row, ...row.data, id: row.id || row.data?.id } : row;
        const docId = row.id || rowData.id;
        if (docId) docsMap.set(String(docId), rowData);
      });
    }
  } catch (_) {}

  const docs = Array.from(docsMap.entries()).map(([id, docData]) => ({
    id,
    data: () => docData,
    exists: () => true
  }));

  return { docs, empty: docs.length === 0 };
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // Generic DB API endpoints for persistent multi-user data storage
  app.get("/api/db/:colName", async (req, res) => {
    try {
      const { colName } = req.params;
      const snap = await getDocs(colName);
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      res.json({ success: true, docs });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || String(err), docs: [] });
    }
  });

  app.get("/api/db/:colName/doc/:docId", async (req, res) => {
    try {
      const { colName, docId } = req.params;
      const snap = await getDoc(colName, docId);
      if (snap.exists()) {
        res.json({ success: true, exists: true, data: snap.data() });
      } else {
        res.json({ success: true, exists: false, data: null });
      }
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || String(err) });
    }
  });

  app.post("/api/db/:colName/bulk", async (req, res) => {
    try {
      const { colName } = req.params;
      const items = req.body.items || [];
      if (!Array.isArray(items) || items.length === 0) {
        return res.json({ success: true, count: 0 });
      }

      const fileData = readCollectionFile(colName);
      items.forEach((item, index) => {
        const docId = item.id || `${colName}_${Date.now()}_${index}_${Math.random().toString(36).substring(2, 8)}`;
        fileData[docId] = { ...item, id: docId };
      });

      writeCollectionFile(colName, fileData);

      // Attempt Supabase
      try {
        const payloads = items.map(item => ({ id: item.id, ...item, data: item }));
        const CHUNK_SIZE = 100;
        for (let i = 0; i < payloads.length; i += CHUNK_SIZE) {
          const chunk = payloads.slice(i, i + CHUNK_SIZE);
          try {
            await supabase.from(colName).upsert(chunk);
          } catch (_) {}
        }
      } catch (_) {}

      res.json({ success: true, count: items.length });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || String(err) });
    }
  });

  app.post("/api/db/:colName/doc", async (req, res) => {
    try {
      const { colName } = req.params;
      const { id, data, merge } = req.body;
      if (!id) {
        return res.status(400).json({ success: false, error: "Missing document id" });
      }
      await setDoc(colName, id, data, { merge });
      res.json({ success: true, id });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || String(err) });
    }
  });

  app.delete("/api/db/:colName/doc/:docId", async (req, res) => {
    try {
      const { colName, docId } = req.params;
      const fileData = readCollectionFile(colName);
      delete fileData[docId];
      writeCollectionFile(colName, fileData);

      try {
        await supabase.from(colName).delete().eq('id', docId);
      } catch (_) {}

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || String(err) });
    }
  });

  app.post("/api/db/:colName/delete-bulk", async (req, res) => {
    try {
      const { colName } = req.params;
      const docIds = req.body.docIds || [];
      if (Array.isArray(docIds) && docIds.length > 0) {
        const fileData = readCollectionFile(colName);
        docIds.forEach(id => {
          delete fileData[id];
        });
        writeCollectionFile(colName, fileData);

        try {
          await supabase.from(colName).delete().in('id', docIds);
        } catch (_) {}
      }
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || String(err) });
    }
  });

  app.post("/api/db/:colName/clear", async (req, res) => {
    try {
      const { colName } = req.params;
      const { courseId } = req.body || {};

      const fileData = readCollectionFile(colName);
      if (courseId) {
        Object.keys(fileData).forEach(id => {
          const item = fileData[id];
          if (!item?.courseId || item.courseId === courseId) {
            delete fileData[id];
          }
        });
        writeCollectionFile(colName, fileData);
        try {
          await supabase.from(colName).delete().eq('courseId', courseId);
        } catch (_) {}
      } else {
        writeCollectionFile(colName, {});
        try {
          await supabase.from(colName).delete().neq('id', '___NON_EXISTENT_ID___');
        } catch (_) {}
      }
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || String(err) });
    }
  });

  // API Route for server-side transaction verification and marking as 'spent'
  app.post("/api/verify-transaction", async (req, res) => {
    try {
      const { email, bkashNumber, trxId } = req.body;

      const cleanEmail = (email || '').trim().toLowerCase();
      const cleanSender = (bkashNumber || '').trim();
      const cleanTrx = (trxId || '').trim().toLowerCase();
      const cleanPhone = (p: string) => (p || '').replace(/\D/g, '').slice(-10);
      const matchPhone = cleanPhone(cleanSender);

      if (!cleanEmail || !cleanEmail.includes('@')) {
        return res.status(400).json({ success: false, reason: "অনুগ্রহ করে একটি সঠিক ইমেইল ঠিকানা প্রদান করুন।" });
      }
      if (!cleanSender || cleanSender.length < 10) {
        return res.status(400).json({ success: false, reason: "অনুগ্রহ করে সঠিক বিকাশ সেন্ডার নম্বর প্রদান করুন।" });
      }
      if (!cleanTrx || cleanTrx.length < 4) {
        return res.status(400).json({ success: false, reason: "অনুগ্রহ করে সঠিক ট্রাঞ্জেকশন আইডি (TrxID) প্রদান করুন।" });
      }

      // SERVER-SIDE CHECK 0: Check lock in 'used_transactions' collection
      const usedTxSnap = await getDoc('used_transactions', cleanTrx);
      if (usedTxSnap.exists()) {
        const usedData = usedTxSnap.data();
        if (usedData.spent === true || usedData.status === 'spent') {
          return res.status(400).json({
            success: false,
            reason: `এই ট্রাঞ্জেকশন আইডিটি (${trxId}) ইতোমধ্যে 'spent' বা ব্যবহৃত হিসেবে 'used_transactions'-এ লক্ করা রয়েছে। একই ট্রাঞ্জেকশন দিয়ে একাধিকবার ব্যালেন্স রিচার্জ সম্ভব নয়।`
          });
        }
      }

      // SERVER-SIDE CHECK 1: Ensure transaction ID was NOT already used or spent in access_requests
      const requestsSnap = await getDocs('access_requests');
      const isAlreadyUsedReq = requestsSnap.docs.some(docSnap => {
        const d = docSnap.data();
        const dTrx = (d.trxId || '').toString().trim().toLowerCase();
        if (dTrx === cleanTrx) {
          // Used if already spent or approved or pending
          return d.spent === true || d.status === 'approved' || d.status === 'pending' || d.verificationMethod === 'auto';
        }
        return false;
      });

      if (isAlreadyUsedReq) {
        return res.status(400).json({
          success: false,
          reason: `এই ট্রাঞ্জেকশন আইডিটি (${trxId}) ইতোমধ্যে একবার সিস্টেমে ব্যবহার বা ক্লেইম করা হয়েছে। একই ট্রাঞ্জেকশন আইডি দিয়ে একাধিকবার রিচার্জ পাওয়া সম্ভব নয়।`
        });
      }

      // SERVER-SIDE CHECK 2: Match against system_settings/global_verified_payments
      const globalVpSnap = await getDoc('system_settings', 'global_verified_payments');
      let allVps: any[] = [];
      let matchedVpIndex = -1;
      let matchedVp: any = null;

      if (globalVpSnap.exists()) {
        allVps = globalVpSnap.data().verifiedPayments || [];
        if (Array.isArray(allVps)) {
          matchedVpIndex = allVps.findIndex((vp: any) => {
            if (vp.spent || vp.claimed) return false;
            const vpPhone = cleanPhone(vp.bkashNumber || '');
            const vpTrx = (vp.trxId || '').toLowerCase().trim();
            return (vpPhone === matchPhone || (vp.bkashNumber || '').trim() === cleanSender) && vpTrx === cleanTrx;
          });
          if (matchedVpIndex !== -1) {
            matchedVp = allVps[matchedVpIndex];
          }
        }
      }

      // Check if matched transaction is already spent / claimed in admin payments
      if (matchedVp) {
        if (matchedVp.spent || matchedVp.claimed) {
          return res.status(400).json({
            success: false,
            reason: `এই ট্রাঞ্জেকশন আইডিটি (${trxId}) ইতোমধ্যে 'Spent/Used' হিসেবে চিহ্নিত রয়েছে (ক্লেইমকারী: ${matchedVp.claimedBy || 'অন্য এক ইউজার'})।`
          });
        }

        // AUTO-VERIFIED MATCH FOUND! Read exact amount from verified payment item
        const addAmount = matchedVp.amount && matchedVp.amount > 0 ? matchedVp.amount : 50;
        const walletSnap = await getDoc('user_wallets', cleanEmail);
        const currentBalance = walletSnap.exists() ? (walletSnap.data().balance || 0) : 0;
        const newBalance = currentBalance + addAmount;
        const nowISO = new Date().toISOString();

        // ATOMIC LOCK: Record transaction in used_transactions collection as 'spent' BEFORE updating wallet balance
        await setDoc('used_transactions', cleanTrx, {
          trxId: cleanTrx,
          spent: true,
          status: 'spent',
          email: cleanEmail,
          usedBy: cleanEmail,
          bkashNumber: cleanSender,
          amount: addAmount,
          createdAt: nowISO,
          usedAt: nowISO
        }, { merge: true });

        // Update Wallet Balance
        await setDoc('user_wallets', cleanEmail, {
          email: cleanEmail,
          bkashNumber: cleanSender,
          balance: newBalance,
          updatedAt: nowISO
        }, { merge: true });

        // Mark transaction as SPENT & CLAIMED in system_settings/global_verified_payments
        allVps[matchedVpIndex] = {
          ...matchedVp,
          spent: true,
          claimed: true,
          claimedBy: cleanEmail,
          claimedAt: nowISO,
          spentAt: nowISO
        };
        await setDoc('system_settings', 'global_verified_payments', { verifiedPayments: allVps }, { merge: true });

        // Record approved request doc with spent = true
        const reqId = `recharge_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        await setDoc('access_requests', reqId, {
          id: reqId,
          courseId: 'wallet_recharge',
          courseTitle: 'Wallet Recharge Claim',
          bkashNumber: cleanSender,
          email: cleanEmail,
          trxId: cleanTrx,
          status: 'approved',
          verificationMethod: 'auto',
          spent: true,
          spentAt: nowISO,
          price: addAmount,
          totalPrice: addAmount,
          createdAt: nowISO,
          requestedBy: cleanEmail
        });

        return res.json({
          success: true,
          autoVerified: true,
          amountAdded: addAmount,
          newBalance,
          message: `অটো-ভেরিফিকেশন সফল! এডমিনের ভেরিফাইড পেমেন্ট থেকে ৳${addAmount} BDT সরাসরি আপনার ওয়ালেটে জমা হয়েছে এবং ট্রাঞ্জেকশনটি 'Spent' হিসেবে রেকর্ড করা হয়েছে। বর্তমান ওয়ালেট ব্যালেন্স: ৳${newBalance} BDT।`
        });
      } else {
        // Submit for manual verification
        const reqId = `recharge_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const nowISO = new Date().toISOString();
        await setDoc('access_requests', reqId, {
          id: reqId,
          courseId: 'wallet_recharge',
          courseTitle: 'Wallet Recharge Claim',
          bkashNumber: cleanSender,
          email: cleanEmail,
          trxId: cleanTrx,
          status: 'pending',
          verificationMethod: 'manual',
          spent: false,
          price: 0,
          totalPrice: 0,
          createdAt: nowISO,
          requestedBy: cleanEmail
        });

        return res.json({
          success: true,
          autoVerified: false,
          message: `আপনার ওয়ালেট রিচার্জ রিকুয়েস্ট সফলভাবে জমা হয়েছে। এডমিন প্যানেল থেকে ভেরিফাই করে দ্রুত আপনার ওয়ালেটে ব্যালেন্স যোগ করা হবে, অনুগ্রহ করে কিছুক্ষণ অপেক্ষা করুন।`
        });
      }
    } catch (err: any) {
      console.error("Server-side transaction verification error:", err);
      return res.status(500).json({ success: false, reason: "সার্ভার এরর: " + (err.message || String(err)) });
    }
  });

  // Initialize Gemini Client
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });

  // API Route for generating fixed example sentences
  app.post("/api/sentences", async (req, res) => {
    try {
      const { word, meaning } = req.body;
      if (!word) {
        return res.status(400).json({ error: "Word is required" });
      }

      // Check if API key is present
      if (!process.env.GEMINI_API_KEY) {
        return res.json({
          sentences: [
            `Please configure your **GEMINI_API_KEY** under Settings to see real example sentences with the word **${word}**.`,
            `The word **${word}** means "${meaning || ''}" in Bengali.`
          ]
        });
      }

      const prompt = `You are an expert English teacher. Write exactly 2 clear, simple, and natural English example sentences for the vocabulary word "${word}" (which means "${meaning || ''}" in Bengali).
The sentences should help a Bengali-speaking student understand how to use this word in daily conversation or academic contexts.
In each sentence, the word "${word}" (or its inflected forms like plural, past tense, third-person singular, etc. e.g. if the word is "Abound", you can use "abounded", "abounding", "abounds" or "abound") MUST be enclosed in double asterisks so it appears bolded in markdown, e.g., "**${word}**".

Return the response in JSON format matching this schema:
{
  "sentences": ["sentence 1", "sentence 2"]
}
`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        }
      });

      const responseText = response.text || "{}";
      const result = JSON.parse(responseText.trim());

      res.json({
        sentences: result.sentences || [
          `This is an example sentence featuring the word **${word}**.`
        ]
      });
    } catch (error: any) {
      console.error("Error generating sentences with Gemini:", error);
      res.status(500).json({ error: error.message || "Failed to generate sentences" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
