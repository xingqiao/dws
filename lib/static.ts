import { Response } from 'https://deno.land/std@0.57.0/http/server.ts';
import { Status } from 'https://deno.land/std@0.57.0/http/http_status.ts';
import { posix as path } from 'https://deno.land/std@0.57.0/path/mod.ts';
import { Context } from './context.ts';
import { MiddlewareHandler, NextHandler } from './utils.ts';
import { getMimeType } from './mime.ts';

const { cwd, stat, readFile } = Deno;

interface staticOption {
    /** 是否等待其他中间件先执行，默认为 false */
    defer?: boolean;
    /** 是否允许访问隐藏文件，默认为 false */
    hidden?: boolean;
    /** 默认文件名，值为 false 时不设置默认文件名，默认值为 index.html */
    index?: string | boolean;
    /** max-age设置，默认为0 */
    maxAge?: number;
    /** 设置immutable属性，默认为 false */
    immutable?: boolean;
    /** 设置额外的返回头 */
    setHeaders?: (res: Response, path: string, info: Deno.FileInfo) => void;
}

/**
 * 处理静态文件
 * @param root 根目录
 * @param option 设置
 */
export function useStatic(root: string, option: staticOption = {}): MiddlewareHandler {
    const { defer, hidden, index, maxAge, immutable, setHeaders } = option;
    const indexFile = typeof index == 'string' ? index : 'index.html';
    return async function (ctx: Context, next: NextHandler<void>) {
        const { method } = ctx;
        let filePath = path.join(path.isAbsolute(ctx.path) ? '' : cwd(), root, ctx.path);
        let info: Deno.FileInfo;
        let matchFile = false;
        if (defer) {
            await next();
        }
        if (method == 'GET' || method == 'HEAD') {
            try {
                info = await stat(filePath);
                if (info.isDirectory && index != false) {
                    filePath = path.join(filePath, indexFile);
                    info = await stat(filePath);
                }
                if (!info.isDirectory) {
                    if (!hidden && /\/\./.test(filePath)) {
                        ctx.throw(403);
                    } else {
                        ctx.type = getMimeType(filePath);
                        if (setHeaders) {
                            setHeaders(ctx.response, ctx.path, info);
                        }
                        ctx.body = await readFile(filePath);
                        if (!ctx.response.headers?.get('Last-Modified') && info.mtime) {
                            ctx.set('Last-Modified', info.mtime?.toUTCString());
                        }
                        if (!ctx.response.headers?.get('Cache-Control')) {
                            const cacheControl = [`max-age=${maxAge ? maxAge | 0 : 0}`];
                            if (immutable) {
                                cacheControl.push('immutable');
                            }
                            ctx.set('Cache-Control', cacheControl.join(','));
                        }
                        matchFile = true;
                    }
                } else {
                    ctx.throw(Status.Forbidden);
                }
            } catch (ex) {
                if (ex.name == 'NotFound') {
                    ctx.throw(Status.NotFound, ex);
                } else {
                    ctx.throw(Status.InternalServerError, ex);
                    // 抛出异常让外层处理
                    throw ex;
                }
            }
        }
        if (!matchFile && !defer) {
            await next();
        }
    };
}
