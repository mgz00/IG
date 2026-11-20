// Compatibilidad del Parcel 1 de la práctica original con versiones nuevas de Node.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
const require = createRequire(import.meta.url);
const build = process.argv[2] === 'build';
const args = build
    ? ['build', './src/index.html', '--public-url', './', '--no-minify', '--no-source-maps']
    : ['./src/index.html', '--open'];
const child = spawn(process.execPath, [require.resolve('parcel-bundler/bin/cli.js'), ...args], {
    cwd: new URL('./', import.meta.url), stdio: 'inherit',
    env: {...process.env, NODE_OPTIONS: [process.env.NODE_OPTIONS, '--openssl-legacy-provider'].filter(Boolean).join(' '),
        DISABLE_V8_COMPILE_CACHE: '1', PARCEL_WORKERS: '1'}
});
child.on('exit', code => { process.exitCode = code ?? 1; });
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
