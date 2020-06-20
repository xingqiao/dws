import { serve, Server } from 'https://deno.land/std@0.57.0/http/server.ts';
import { Status } from 'https://deno.land/std@0.57.0/http/http_status.ts';
import { MiddlewareHandler, MiddlewareAsyncHandler } from './lib/utils.ts';
import { Context } from './lib/context.ts';
export { useStatic } from './lib/static.ts';

interface DWSOption {
    /** 系统环境，默认 development */
    env?: string;
    /** 不打印错误信息，默认为 false */
    silent?: boolean;
}

const ALL_ALLOWED = 'ALL';

export class DWS {
    /** 启动环境 */
    env: string;

    /** 不打印错误信息 */
    silent: boolean;

    /** 中间件列表 */
    middleware: (MiddlewareHandler | MiddlewareAsyncHandler)[];

    constructor(option?: DWSOption) {
        this.middleware = [];
        this.env = option?.env || 'development';
        this.silent = option?.silent || false;
    }

    /**
     * 仿照 koa-compose 实现，执行中间件
     * @param ctx 
     */
    private async exec(ctx: Context): Promise<void> {
        const list = this.middleware;
        let index = -1;

        async function dispatch(i: number): Promise<void> {
            if (i <= index) {
                return Promise.reject(new Error('next() called multiple times'));
            }
            index = i;
            const handler = list[i];
            if (!handler) {
                return Promise.resolve();
            }
            try {
                return Promise.resolve(handler(ctx, dispatch.bind(null, i + 1)));
            } catch (err) {
                return Promise.reject(err);
            }
        }

        return dispatch(0);
    }

    /**
     * 启动服务端口监听
     *
     * @param {number} port 要监听的端口号
     * @param {Function} callback 监听成功后执行
     * @api public
     */
    async listen(port: number, callback?: (s: Server) => void): Promise<void> {
        const server = serve({ port });

        if (typeof callback == 'function') {
            callback(server);
        }

        for await (const req of server) {
            const ctx = new Context(req);
            if (ctx.method == 'POST') {
                await ctx.parseBody();
            }
            this.exec(ctx)
                .catch(error => this.onerror(error, ctx))
                .finally(() => {
                    const { response, status } = ctx;
                    if (response.body == undefined && status != Status.OK) {
                        response.body = ctx.message;
                    }
                    req.respond(response);
                });
        }
    }

    /**
     * 添加中间件
     *
     * @param method 请求方法，值为空或all时不做限制，可以匹配全部请求
     * @param path 请求路径，支持字符串或正则匹配
     * @param handler
     * @return self
     * @api public
     */
    use(method: string, path: string | RegExp, handler: MiddlewareHandler): this;
    use(method: string, path: string | RegExp, handler: MiddlewareAsyncHandler): this;
    use(path: string | RegExp, handler: MiddlewareHandler): this;
    use(path: string | RegExp, handler: MiddlewareAsyncHandler): this;
    use(handler: MiddlewareHandler): this;
    use(handler: MiddlewareAsyncHandler): this;
    use(...args: any[]): this {
        while (args.length < 3) {
            args.unshift('');
        }
        const method: string = args[0].toUpperCase() || ALL_ALLOWED;
        const path: string | RegExp = args[1];
        const handler: MiddlewareHandler = args[2];
        this.middleware.push(async (ctx, next) => {
            const methodMathed = method == ALL_ALLOWED || method == ctx.method;
            const pathMathed = !path || (typeof path == 'string' ? path == ctx.path : path.test(ctx.path));
            if (methodMathed && pathMathed) {
                return await handler(ctx, next);
            } else if (next) {
                return await next();
            }
        });
        return this;
    }

    /**
     * 默认错误处理逻辑
     * @param error 错误信息
     * @param ctx 错误信息
     * @api private
     */
    onerror(error: any, ctx: Context) {
        // 将错误信息打印到控制台
        if (!this.silent) {
            const msg = error.stack || error.toString();
            console.error();
            console.error(msg.replace(/^/gm, '  '));
            console.error();
        }

    }
}
