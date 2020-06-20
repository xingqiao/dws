
let process: Deno.Process;
let timer: number = 0;

function start() {
    if (process) {
        process.kill(Deno.Signal.SIGINT);
        console.log('> 重启进程', process);
    }
    process = Deno.run({
        cmd: ['deno', 'run', '--allow-net', '--allow-read', 'index.ts']
    });
}

start();

// 监听文件变化，自动重启服务
const watcher = Deno.watchFs('..');
for await (const event of watcher) {
    clearTimeout(timer);
    timer = setTimeout(start, 100);
}
