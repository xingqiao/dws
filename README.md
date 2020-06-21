![](https://repository-images.githubusercontent.com/273481965/8c6b2400-b30d-11ea-856b-a1c3a839152c)

![deno](https://img.shields.io/github/v/release/denoland/deno.svg?label=deno)
![MulanPSL2](https://img.shields.io/badge/license-MulanPSL2-green)


基于 [Deno](https://deno.land/) 平台的 web 开发框架，类似 [Koa](https://github.com/koajs/koa)，按照类似堆栈的方式组织和执行，自带路由实现和静态资源托管，支持 [Nunjucks](https://mozilla.github.io/nunjucks/) 模板引擎。

## Hello DWS

```js
// index.ts
import { DWS } from 'https://gitee.com/ccts/dws/raw/master/index.ts';

const app = new DWS();

// 设置中间件
app.use(ctx => {
    ctx.body = 'Hello DWS';
});

// 监听端口
app.listen(8000);
```

启动
```sh
deno run --allow-net --allow-read index.ts
```

## 路由和中间件

`DWS` 的中间件基础模式和 Koa 类似，使用 `use()` 方法设置，支持异步函数和普通函数两种。此外，`DWS` 将路由功能整合到中间件设置，支持根据请求方法和请求路径匹配分发请求。

### 普通模式

```js
// use(handler: MiddlewareHandler): this;

// 异步函数中间件
app.use(async (ctx, next) => {
    const start = Date.now();
    await next();
    const ms = Date.now() - start;
    console.log(`${ctx.method} ${ctx.url} - ${ms}ms`);
});

// 普通函数中间件
app.use((ctx, next) => {
    const start = Date.now();
    return next().then(() => {
        const ms = Date.now() - start;
        console.log(`${ctx.method} ${ctx.url} - ${ms}ms`);
    });
});
```

### 匹配请求路径

```js
// use(path: string | RegExp, handler: MiddlewareHandler): this;

// 字符串方式匹配
app.use('/hallo', async ctx => {
    ctx.body = 'Hello DWS';
});

// 正则方式匹配
app.use(/\w+\/hallo/i, ctx => {
    ctx.redirect('/hallo');
});
```

- 支持字符串和正则两种匹配方式
- 字符串方式为完整匹配，大小写敏感
- 正则方式灵活性更高，可以忽略大小写，方便收归请求

### 匹配请求方法

```js
// use(method: string, path: string | RegExp, handler: MiddlewareHandler): this;

// 匹配GET请求
app.use('GET', '/hallo', async ctx => {
    console.log(ctx.query);
});

// 匹配POST请求
app.use('POST', '/hallo', async ctx => {
    console.log(ctx.requestBody);
});

// 匹配所有方法
app.use('ALL', '/hallo', async ctx => {
    console.log(ctx.method);
});
```

- 支持的方法：`GET`、`POST`、`PUT`、`DELETE`，设置为 `ALL` 时可以匹配任意方法
- `url` 上的请求参数存放于 `ctx.query`
- `POST` 请求 `body` 中的数据存放于 `ctx.requestBody`

## 使用模板渲染

`DWS` 集成了 `Nunjucks` 模板引擎，模板语法详见 [Nunjucks API 说明](https://mozilla.github.io/nunjucks/)

模板文件默认放在 `views` 目录，使用时调用 `ctx.render` 方法，渲染结果会自动设置到 `ctx.body` 上，如果只想要获得渲染结果可以调用 `ctx.renderString` 方法。

```js
app.use('GET', '/', async ctx => {
    await ctx.render('index.html', { username: 'James' });
});

app.use('GET', '/', async ctx => {
    ctx.body = await ctx.renderString('index.html', { username: 'James' });
});
```

## 处理静态资源

```js
import { DWS, useStatic } from 'https://gitee.com/ccts/dws/raw/master/index.ts';

const app = new DWS();

// 设置静态资源路由
app.use(useStatic('public', {
    maxAge: 600
}));

// 监听端口
app.listen(8000);
```

通过 `useStatic` 处理静态资源时，支持的配置参数有：
```js
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
```

## 其他主要 Context 属性或方法

和 `Koa` 类似，每个中间件触发时，方法的第一个参数是 DWS 的 `Context` 对象，我们可以通过该对象获取请求参数及设置返回数据。

```js
app.use(async (ctx, next) => { await next(); });
```

### 302重定向

```js
ctx.redirect('/hallo');
```

### 获取请求头字段

```js
// 不区分大小写
ctx.get('Accept');
```

### 设置响应头字段

支持多种方式设置

```js
ctx.set('Content-Type', 'text/html');
// => Content-Type: text/html

ctx.set({
    'Content-Type': 'text/html',
    'ABC': 'DEF'
});
// => Content-Type: text/html
// => ABC: DEF


ctx.set(['Content-Type', 'ABC'], 'text/html');
// => Content-Type: text/html
// => ABC: text/html
```

### 其他属性

```js
// 请求方法，大写
ctx.method
// => GET

// 请求链接
ctx.url
// => /index.html

// 请求链接
ctx.url
// => /index.html?key=value

// 请求路径
ctx.path
// => /index.html

// 查询字符串
ctx.search
// => key=value&key2=value2

// 查询参数
ctx.query
// => { key: value, ... }

// POST 请求参数
ctx.requestBody
// 根据请求 Content-Type 自动解析成对应表单、JSON对象或字符串

// 请求头 cookies
ctx.cookies
// => { key: value, ... }
```

## 性能测试

使用 [autocannon](https://github.com/mcollina/autocannon) 进行并发测试
- Running 5s
- 100 connections with 2 pipelining factor

### DWS

| Stat    | 2.5% | 50%  | 97.5% | 99%  | Avg     | Stdev   | Max       |
| ------- | ---- | ---- | ----- | ---- | ------- | ------- | --------- |
| Latency | 1 ms | 2 ms | 3 ms  | 4 ms | 1.89 ms | 1.34 ms | 111.15 ms |

| Stat      | 1%      | 2.5%    | 50%     | 97.5%   | Avg      | Stdev   | Min     |
| --------- | ------- | ------- | ------- | ------- | -------- | ------- | ------- |
| Req/Sec   | 35647   | 35647   | 42719   | 42975   | 41308.81 | 2844.13 | 35647   |
| Bytes/Sec | 4.46 MB | 4.46 MB | 5.34 MB | 5.37 MB | 5.16 MB  | 355 kB  | 4.46 MB |

207k requests in 5.06s, 25.8 MB read

### Koa

| Stat    | 2.5% | 50%  | 97.5% | 99%  | Avg     | Stdev  | Max      |
| ------- | ---- | ---- | ----- | ---- | ------- | ------ | -------- |
| Latency | 0 ms | 1 ms | 5 ms  | 8 ms | 2.17 ms | 2.9 ms | 84.46 ms |

| Stat      | 1%     | 2.5%   | 50%     | 97.5%   | Avg     | Stdev   | Min    |
| --------- | ------ | ------ | ------- | ------- | ------- | ------- | ------ |
| Req/Sec   | 29599  | 29599  | 43103   | 43967   | 40606.4 | 5529.94 | 29595  |
| Bytes/Sec | 4.5 MB | 4.5 MB | 6.55 MB | 6.68 MB | 6.17 MB | 840 kB  | 4.5 MB |

203k requests in 5.05s, 30.9 MB read
