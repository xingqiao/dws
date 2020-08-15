import { DWS, useStatic } from 'https://deno.land/x/dws/mod.ts';

const app = new DWS();

app.use(useStatic('public', {
    maxAge: 600
}));

app.use('GET', '/index.html', ctx => {
    ctx.redirect('/');
});

app.use('GET', '/', async ctx => {
    console.log(ctx)
    await ctx.render('index.html', { username: 'James' });
});

app.use('all', /hallo/i, async (ctx, next) => {
    await ctx.render('data.html', {
        data: JSON.stringify({
            method: ctx.method,
            query: ctx.query,
            body: ctx.requestBody,
            cookies: ctx.cookies
        }, null, 4)
    });
    await next();
});

app.listen(8000);
console.log('> 服务启动');
