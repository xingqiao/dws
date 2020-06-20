import { ServerRequest, Response } from 'https://deno.land/std@0.57.0/http/server.ts';
import { getCookies, Cookies } from 'https://deno.land/std@0.57.0/http/cookie.ts';
import { Status, STATUS_TEXT } from 'https://deno.land/std@0.57.0/http/http_status.ts';
import { Buffer } from 'https://deno.land/std@0.57.0/node/buffer.ts';
import { MultipartReader } from 'https://deno.land/std@0.57.0/mime/multipart.ts';
import { parseQuerys, Querys, Headers, render } from './utils.ts';
import { getMimeType } from './mime.ts';

export class Context {
    acceptsLanguages: string = '';
    /** 获取请求方法 */
    method: string;
    /** 获取请求协议 */
    protocol: string;
    /** 获取请求域名 */
    host: string;
    /** 获取请求域名，不包含端口 */
    hostname: string;
    /** 获取请求域名 */
    origin: string;
    /** 请求链接 */
    url: string;
    /** 请求路径 */
    path = '';
    /** 查询字符串 */
    search = '';
    /** 查询参数 */
    query: Querys = {};
    header: Headers = {};
    headers = this.header;
    /** 请求头 cookies */
    cookies: Cookies;
    /** POST 请求参数 */
    requestBody: string | Querys | Object = {};
    request: ServerRequest;
    response: Response;

    /** 标记是否手动指定返回码 */
    private _explicitStatus: boolean = false;

    /** 标记是否已经完成POST的body解析 */
    private _isBodyParsed: boolean = false;

    constructor(request: ServerRequest) {
        const { url, method, proto, headers } = request;
        this.request = request;
        this.response = {
            status: Status.NotFound,
            headers: new Headers(),
            body: undefined,
        };
        headers.forEach((value: string, key: string) => {
            this.header[key] = value;
        });
        this.cookies = getCookies(request);
        this.method = method.toUpperCase();
        this.protocol = 'http';
        this.host = (this.get('X-Forwarded-Host') || (this.request.protoMajor >= 2 && this.get(':authority')) || this.get('Host') || '').split(/\s*,\s*/, 1)[0];
        this.hostname = this.host.split(':', 1)[0];
        this.origin = `${this.protocol}://${this.host}`;
        this.url = url;
        if (/\?[^]*/.test(url)) {
            const [path, search] = url.split('?');
            this.path = decodeURIComponent(path);
            if (search) {
                this.search = '?' + search;
                this.query = parseQuerys(search);
            }
        } else {
            this.path = decodeURIComponent(url);
        }
        this.set('Server', 'DWS');
        this.set('Content-Type', 'text/html');
        this.set('date', new Date().toUTCString());
    }

    /**
     * this.response.body
     */
    get body(): Uint8Array | Deno.Reader | string | undefined {
        return this.response.body;
    }

    set body(value: Uint8Array | Deno.Reader | string | undefined) {
        const { _explicitStatus: explicitStatus, response, type } = this;
        response.body = value;
        if (!type && typeof value == 'string') {
            this.type = /^\s*</.test(value) ? 'html' : 'text';
        }
        if (!explicitStatus) {
            response.status = Status.OK;
        }
        if (value instanceof Uint8Array) {
            this.length = value.byteLength;
        } else if (typeof value == 'string') {
            this.length = Buffer.byteLength(value);
        } else {
            this.set('Content-Length', null);
        }
    }

    /**
     * this.response.headers?.get('Content-Length')
     */
    get length(): number {
        const length = this.response.headers?.get('Content-Length');
        return length ? parseInt(length, 10) : 0;
    }

    set length(value: number) {
        this.set('Content-Length', value);
    }

    /**
     * 获取返回的 Content-Type 设置
     * @return {string}
     * @api public
     */
    get type() {
        const type = this.response.headers?.get('Content-Type');
        if (!type) {
            return '';
        }
        return type.split(';', 1)[0];
    }

    /**
     * 设置 Content-Type，当输入是文件名时，会根据文件类型解析
     * @param {string} type
     * @api public
     * @example
     *     this.type = 'text/html';
     *     // => Content-Type = 'text/html'
     *
     *     this.type = '.html';
     *     // => Content-Type = 'text/html'
     */
    set type(value: string) {
        this.set('Content-Type', getMimeType(value));
    }

    /**
     * 获取HTTP返回码
     * @return {number}
     * @api public
     */
    get status() {
        return this.response.status;
    }

    /**
     * 设置HTTP返回码
     * @param {number} code
     * @api public
     */
    set status(code) {
        this.response.status = code;
        this._explicitStatus = true;
    }

    /**
     * 获取返回码对应的状态说明
     */
    get message() {
        const { status } = this;
        return STATUS_TEXT.get(<Status>status);
    }

    /**
     * 获取请求头字段（忽略大小写）
     * @param {string} name
     * @return {string}
     * @api public
     * @example
     *     this.get('Content-Type');
     *     // => 'text/plain'
     *
     *     this.get('content-type');
     *     // => 'text/plain'
     *
     *     this.get('Something');
     *     // => ''
     */
    get(name: string): string {
        const { headers } = this;
        switch ((name = name.toLowerCase())) {
            case 'referer':
            case 'referrer':
                return headers.referrer || headers.referer || '';
            default:
                return headers[name] || '';
        }
    }

    /**
     * 设置响应头字段，值为 null 时删除该字段
     * @param {string|Object|Array} name
     * @param {string} value
     * @api public
     * @example
     *    this.set('Content-Type', 'text/html');
     *    this.set(['Content-Type', 'ABC'], 'Content-Type');
     *    this.set({ 'Content-Type': 'text/html', 'X-API-Key': 'tobi' });
     */
    set(name: string | Object | Array<string>, value?: string | number | null | undefined) {
        const { headers } = this.response;
        if (headers) {
            const strValue = typeof value == 'number' ? value.toString() : value;
            function set(key: string) {
                if (strValue == undefined || strValue == null) {
                    headers?.delete(key);
                } else {
                    headers?.set(key, strValue);
                }
            }
            if (Array.isArray(name)) {
                name.forEach(set);
            } else if (typeof name == 'string') {
                set(name);
            } else {
                for (const key in name) {
                    set(key);
                }
            }
        }
    }

    /**
     * 解析POST请求的Body参数，并设置到 this.requestBody 上
     * @api public
     */
    async parseBody(): Promise<string | Object | Querys> {
        if (this.method != 'POST' || this._isBodyParsed) {
            return this.requestBody;
        }
        const { request } = this;
        const contentType = this.get('Content-Type');
        if (/multipart\/form-data/i.test(contentType)) {
            const boundary = contentType.match(/boundary=(.+)$/i);
            if (boundary) {
                const mr = new MultipartReader(request.body, boundary[1]);
                const form = await mr.readForm();
                const map = new Map(form.entries());
                const body: Querys = {};
                map.forEach((value, key) => {
                    body[<string>key] = value;
                });
                this.requestBody = body;
            }
        } else if (contentType) {
            const body = await Deno.readAll(request.body);
            const charset = contentType.match(/charset='([^]*)'/i);
            const decoder = new TextDecoder(charset ? charset[1] : 'utf-8');
            const bodyString = decoder.decode(body);
            if (/application\/x-www-form-urlencoded/i.test(contentType)) {
                this.requestBody = parseQuerys(bodyString);
            } else if (/application\/json/i.test(contentType)) {
                try {
                    this.requestBody = JSON.parse(bodyString);
                } catch (error) {
                    console.error('Error while parse json', error);
                    this.requestBody = {};
                }
            } else if (contentType.includes('text')) {
                this.requestBody = bodyString;
            }
        }
        return this.requestBody;
    }

    /**
     * 302重定向到指定页面
     * @param url 跳转链接
     */
    redirect(url: string): void {
        this.status = Status.Found;
        this.set('Location', url || '/');
    }

    /**
     * 渲染模版
     * @param view 要使用的模版，默认在views目录
     * @param params 数据
     */
    async render(view: string, params: Querys): Promise<void> {
        this.body = await render(view, params);
    }

    /**
     * 渲染模版，不设置到 body 上
     * @param view 要使用的模版，默认在views目录
     * @param params 数据
     */
    async renderString(view: string, params: Querys): Promise<string> {
        return await render(view, params);
    }

    /**
     * 返回异常，默认HTTP返回码500
     * @param {number|string|Error} status HTTP状态码或错误信息
     * @param {string} [message] 错误描述
     * @api public
     * @example
     *    this.throw(403)
     *    this.throw(400, 'name required')
     */
    throw(status: number | string | Error, message?: string | Error) {
        if (typeof status != 'number') {
            message = status;
            status = Status.InternalServerError;
        }
        this.body = message ? '' + message : '';
        this.response.status = status;
    }
}
