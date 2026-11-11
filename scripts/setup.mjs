import { ensureFile } from './setup-lib.mjs';

const created = [];

if (ensureFile('.env.example', '.env')) {
	created.push('.env (a partir de .env.example)');
}
if (ensureFile('data/hub.example.json', 'data/hub.json')) {
	created.push('data/hub.json (a partir do exemplo)');
}

if (created.length > 0) {
	console.log('Criado:');
	for (const item of created) console.log(`- ${item}`);
} else {
	console.log('Nada a criar: .env e data/hub.json já existem.');
}

console.log('\nPróximos passos:');
console.log('1. npm ci');
console.log('2. npm run build');
console.log('3. npm start  (http://127.0.0.1:5757)');
console.log('4. opcional: powershell -ExecutionPolicy Bypass -File scripts\\install-autostart.ps1');
