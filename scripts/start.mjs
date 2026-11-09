// Sobe o build de produção apenas em localhost, com porta padrão 5757.
process.env.HOST ??= '127.0.0.1';
process.env.PORT ??= '5757';

await import('../build/index.js');
