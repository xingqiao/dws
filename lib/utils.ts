import { FormFile } from 'https://deno.land/std@0.57.0/mime/multipart.ts';
import { posix as path } from 'https://deno.land/std@0.57.0/path/mod.ts';
import { Context } from './context.ts';
import './nunjucks.js';

interface Source {
    src: string,
    path: string,
    noCache: boolean
}

interface Nunjucks {
    configure: (opts: any) => void;
    compile: (str: string) => Template;
    renderString: (str: string, data: Querys) => string;
    Environment: new (loader: Loader) => Environment
};

interface Environment {
    render: (name: string, data: Querys, callback: any) => void;
    renderString: (str: string, data: Querys) => string;
};

interface Template {
    render: (data: Querys) => string;
};

/** 请求参数 */
export interface Querys {
    [key: string]: string | FormFile | FormFile[] | undefined
}

/** 请求头 */
export interface Headers {
    [key: string]: string;
}

export type NextHandler<T> = (value?: T) => Promise<T>
export type MiddlewareHandler = (ctx: Context, next: NextHandler<void>) => Promise<void>
export type MiddlewareAsyncHandler = (ctx: Context, next: NextHandler<void>) => void

/**
 * nunjucks模版加载器
 */
class Loader {
    async: boolean = true;
    getSource(name: string, callback: (error: any, result?: Source) => void): void {
        if (!path.isAbsolute(name)) {
            name = path.join(cwd(), 'views', name);
        }
        loadView(name)
            .then(str => {
                callback(null, {
                    src: str,
                    path: name,
                    noCache: false
                });
            })
            .catch(callback);
    }
}

const { cwd, readFile } = Deno;
const nunjucks: Nunjucks = (<any>window).nunjucks;
const viewCache: Map<string, string | Promise<string>> = new Map();
const env = new nunjucks.Environment(new Loader());

/**
 * 加载模版文件
 * @param filePath 
 */
async function loadView(filePath: string): Promise<string> {
    filePath = path.normalize(filePath);
    let view = viewCache.get(filePath);
    if (typeof view == 'string') {
        return view;
    } else if (view == undefined) {
        view = readFile(filePath).then(data => {
            const decoder = new TextDecoder('utf-8');
            return decoder.decode(data);
        });
        viewCache.set(filePath, view);
    }
    view = await view;
    viewCache.set(filePath, view);
    return view;
}

/**
 * 解析URL参数
 * @param args 二维数组
 */
export function parseQuerys(queryString: string): Querys {
    const query: Querys = {};
    queryString.split('&').forEach(item => {
        const [key, value] = item.trim().split('=');
        if (key) {
            query[decodeURIComponent(key)] = value ? decodeURIComponent(value) : '';
        }
    });
    return query;
}

/**
 * 渲染模版
 * @param viewPath 模版路径
 * @param data 数据
 * @returns
 */
export async function render(viewPath: string, data: Querys): Promise<string> {
    if (!path.isAbsolute(viewPath)) {
        viewPath = path.join(cwd(), 'views', viewPath);
    }
    return new Promise((resolve, reject) => {
        env.render(viewPath, data, (error: any, result: string) => {
            if (error) {
                reject(error);
            } else {
                resolve(result);
            }
        });
    })
}
