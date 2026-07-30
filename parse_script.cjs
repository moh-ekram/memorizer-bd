const fs = require('fs');

const raw = fs.readFileSync('./src/lib/raw_user_data.txt', 'utf8');
const lines = raw.split('\n').map(l => l.trim()).filter(l => l.length > 0);

// Simple state machine parser for Firestore copy-paste text
function parseLines(lines) {
  let root = {};
  let stack = [{ obj: root, type: 'map' }];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (line === '(map)') {
      // Previous line was key or index
      const key = lines[i - 1];
      const parent = stack[stack.length - 1];
      const newMap = {};
      if (parent.type === 'array') {
        parent.obj.push(newMap);
      } else {
        parent.obj[key] = newMap;
      }
      stack.push({ obj: newMap, type: 'map', key });
    } else if (line === '(array)') {
      const key = lines[i - 1];
      const parent = stack[stack.length - 1];
      const newArr = [];
      if (parent.type === 'array') {
        parent.obj.push(newArr);
      } else {
        parent.obj[key] = newArr;
      }
      stack.push({ obj: newArr, type: 'array', key });
    } else if (line === '(string)') {
      const valStr = lines[i - 1];
      const key = lines[i - 2];
      const val = valStr.startsWith('"') && valStr.endsWith('"') ? valStr.slice(1, -1) : valStr;
      const parent = stack[stack.length - 1];
      if (parent.type === 'array') {
        parent.obj.push(val);
      } else {
        parent.obj[key] = val;
      }
    } else if (line === '(boolean)') {
      const valStr = lines[i - 1];
      const key = lines[i - 2];
      const val = valStr === 'true';
      const parent = stack[stack.length - 1];
      if (parent.type === 'array') {
        parent.obj.push(val);
      } else {
        parent.obj[key] = val;
      }
    } else if (line === '(int64)') {
      const valStr = lines[i - 1];
      const key = lines[i - 2];
      const val = parseInt(valStr, 10);
      const parent = stack[stack.length - 1];
      if (parent.type === 'array') {
        parent.obj.push(val);
      } else {
        parent.obj[key] = val;
      }
    }
  }

  return root;
}

const parsed = parseLines(lines);
console.log('Keys in parsed object:', Object.keys(parsed));
console.log('Sample progress keys:', Object.keys(parsed.progress || {}).slice(0, 10));
console.log('Enrolled course ids:', parsed.enrolledCourseIds);

const fileContent = `export const RECOVERED_USER_DATA: any = ${JSON.stringify(parsed, null, 2)};\n`;
fs.writeFileSync('./src/lib/importedUserData.ts', fileContent);
console.log('Successfully wrote src/lib/importedUserData.ts!');
