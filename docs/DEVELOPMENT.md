# next-open-forge 开发文档

> 本文档是对 [next-open-forge](https://github.com/xiaoyuai1/next-open-forge) 仓库的实际分析结果(基于 main 分支,commit `ac24745`),并在 2026-10-07 完成 vinext + Cloudflare Workers 迁移后同步更新。
> **以后在本仓库的一切开发任务,先读本档,按「第 8 节 架构约定」「第 9 节 常见任务 SOP」「第 12 节 vinext/Cloudflare 部署」执行。**
>
> ⚠️ 注意:仓库根 README.md 继承自上游 next-forge,与本仓库实际结构有出入,以本文档为准。
>
> 📌 **2026-10-07 重大变更**:依赖全量升级到最新;apps/app 与 apps/docs 已迁移到 vinext 构建并部署到 Cloudflare Workers(forge.3webweb.com / forge-docs.3webweb.com);数据库从 PostgreSQL(node-postgres)迁移到 Cloudflare D1(SQLite);`cacheComponents` 已关闭。apps/web 与 apps/storybook 保持 Next.js 工具链,不参与部署。

## 1. 项目概述

next-open-forge 是 [next-forge](https://www.next-forge.com) 的开源替代版 fork:把上游的专有服务(Clerk、Stripe、Axiom、Better Stack 等)替换为开源方案(Better Auth、PostHog 自托管、console 等),并裁剪掉不常用服务,形成一个**生产级 Turborepo + Next.js 模板**(现已同时支持 vinext/Vite 工具链部署到 Cloudflare)。

设计理念(继承上游):Fast / Cheap / Opinionated / Modern / Safe(端到端类型安全)。

## 2. 技术栈与版本(以 package.json 为准,2026-10-07 更新)

| 类别 | 选型 | 版本 |
| --- | --- | --- |
| 运行时 | Node.js | `>=24`(本机 24.21) |
| 包管理 | pnpm(`packageManager` 锁定) | `pnpm@12.9.1`(注意 pnpm 12 的 `allowBuilds` 配置) |
| Monorepo | Turborepo + pnpm workspace | turbo `^2.11.7` |
| 框架 | Next.js(仅 web/storybook 与类型兜底) | `16.3.8` |
| 构建与部署 | **vinext + @vinext/cloudflare**(app 与 docs) | `1.0.1` + `@cloudflare/vite-plugin 2.0.0-beta.sha-52b0dc0e9` + `cf 1.0.0-beta.12` + vite `8.3.0` |
| UI 运行时 | React | `19.3.0` |
| 样式 | Tailwind CSS v4(PostCSS 插件,无 config 文件) | `^4.3.3` |
| 组件库 | shadcn/ui(style: `radix-vega`,base-ui + radix-ui)+ lucide 图标 | shadcn `^4.21.2`,lucide-react `^1.52.0` |
| 认证 | Better Auth(email+password,nextCookies,username 插件) | `^1.7.7` |
| ORM | Drizzle ORM(**D1/SQLite 驱动**,d1 内置于 drizzle-orm) | `^0.45.3` / kit `^0.31.11` |
| 数据库 | **Cloudflare D1**(binding 名 `DB`,库名 `forge-db`) | — |
| 校验 | Zod | `^4.6.5` |
| 环境变量 | @t3-oss/env-nextjs(每包 `keys.ts` 模式) | `^0.13.11` |
| 分析 | PostHog(posthog-js + posthog-node) | `^1.438.1` / `^5.55.0` |
| Lint/Format | Ultracite(Biome 封装,预设路径改为 `ultracite/biome/*`) | `7.12.4` / biome `2.5.15` |
| 测试 | Vitest + Testing Library(jsdom) | `^5.0.3` |
| 文档站 | Fumadocs(fumadocs-mdx,**经 `fumadocs-mdx/vite` 插件编译**) | `^16.16.1` / mdx `^15.4.6` |
| 组件工作台 | Storybook | `^10.2.7` |
| 国际化 | next-international + languine(apps/web 已用) | `^1.3.1` |
| TypeScript | strict(**TS 7.0.2**,Go 原生 tsc;无 baseUrl) | `^7.0.2` |

## 3. 仓库结构

```
next-open-forge/
├── apps/                          # 可部署应用
│   ├── app/                       # 主应用(认证、数据库)—— port 3000
│   ├── docs/                      # 文档站 Fumadocs     —— port 3002
│   └── storybook/                 # 组件工作台          —— port 6006
├── packages/                      # 共享包(@repo/*)
│   ├── auth/                      # @repo/auth          Better Auth
│   ├── database/                  # @repo/database      Drizzle + pg
│   ├── design-system/             # @repo/design-system shadcn 全量组件
│   ├── internationalization/      # @repo/internationalization(未接入)
│   ├── next-config/               # @repo/next-config   共享 NextConfig + rewrites
│   ├── product/                   # @repo/product       PostHog + 错误上报
│   ├── seo/                       # @repo/seo           metadata + JSON-LD
│   └── typescript-config/         # @repo/typescript-config  共享 tsconfig
├── scripts/                       # next-forge CLI(init/update),tsup 打包,面向上游发布
├── turbo/generators/              # `turbo gen init` 新建共享包模板(plop)
├── biome.jsonc                    # ultracite lint 配置
├── turbo.json                     # 任务编排(build/test/analyze/dev/translate)
└── pnpm-workspace.yaml            # workspace: apps/* + packages/*
```

### 包依赖关系

```
typescript-config ─→ 所有包(仅 devDependencies)

database(独立) ← auth
product(独立)
next-config(独立)
seo(独立)
design-system → auth, product
internationalization(独立,未被任何 app 引用)

app       → design-system, auth, database, next-config, product, seo
docs      → design-system
storybook → design-system
```

## 4. 应用详解(apps/)

### 4.1 apps/app — 主应用(port 3000)

Next.js 16 App Router,核心结构:

```
apps/app/
├── app/
│   ├── layout.tsx                     # 根布局:DesignSystemProvider + 字体
│   ├── global-error.tsx               # 全局错误页(product.captureException 上报)
│   ├── actions/auth.ts                # 认证守卫的 Server Actions 封装
│   ├── api/auth/[...all].ts           # Better Auth handler 挂载点(GET/POST)
│   ├── (authenticated)/               # 登录后区域:sidebar 布局,requireAuthenticatedUser 守卫
│   │   ├── layout.tsx                 # SidebarProvider + 守卫(Suspense 包裹)
│   │   ├── page.tsx                   # 示例页:database.query.pages.findMany()
│   │   └── search/page.tsx
│   └── (unauthenticated)/             # 未登录区域:sign-in / sign-up,居中双栏布局
│       ├── layout.tsx                 # requireUnauthenticatedUser 守卫
│       └── sign-in|sign-up/
│           ├── actions/index.ts       # "use server":signInSubmit / signUpSubmit
│           ├── schemas/index.ts       # zod 4 表单校验
│           └── components/*-form.tsx  # react-hook-form + @hookform/resolvers
├── env.ts                             # 聚合所有包 keys(见第 6 节)
├── next.config.ts                     # @repo/next-config 的 config + ANALYZE 条件挂 analyzer
├── instrumentation-client.ts          # 客户端 PostHog 初始化
└── vitest.config.mts                  # jsdom;alias: @ → 本目录, @repo → ../../packages
```

要点:

- **认证守卫在布局层**,不是 middleware:`(authenticated)/layout.tsx` 调 `requireAuthenticatedUser()`(未登录 redirect `/sign-in`),`(unauthenticated)/layout.tsx` 调 `requireUnauthenticatedUser()`(已登录 redirect `/`)。守卫本身是 Server Action,定义在 `app/actions/auth.ts`。
- `scripts/skip-ci.js`:commit message 含 `[skip ci]` 时 exit 0,供 Vercel 跳过构建。
- 测试:`pnpm --filter app test`(vitest run)。

### 4.2 apps/docs — 文档站(port 3002)

- Fumadocs(fumadocs-mdx):`source.config.ts` + `lib/source.ts` 驱动,内容在 `content/docs/*.mdx`。
- 新增文档:在 `apps/docs/content/docs/` 下建 `.mdx` 文件即可(有 front matter: title/description)。
- 附带 `/api/search`、`/llms-full.txt`、OG 图路由。

### 4.3 apps/storybook — 组件工作台(port 6006)

- `stories/*.stories.tsx` 覆盖 design-system 全量 UI 组件(含 action-button、mode-toggle 自定义件)。
- **给 design-system 加新组件时,必须在这里补 stories**(上游惯例,见 git 历史)。
- 接入 Chromatic(`pnpm --filter storybook chromatic`,需 token)。

## 5. 共享包详解(packages/)

### 5.1 @repo/database — Drizzle + PostgreSQL

```
packages/database/
├── index.ts          # 单例:drizzle(keys().DATABASE_URL, { schema: schemas })
├── keys.ts           # createEnv 校验 DATABASE_URL(z.url(),server)
├── drizzle.config.ts # out: ./drizzle, dialect: postgresql
└── schemas/
    ├── index.ts      # 汇总导出所有 schema 模块(namespace import,Drizzle 要求)
    ├── auth.ts       # Better Auth 四表:user / session / account / verification
    └── pages.ts      # demo 表 "page"(id serial, name varchar)
```

- 业务代码通过 `import { database } from "@repo/database"` 后用 `database.query.*`(relational query)访问。
- ⚠️ `schemas/auth.ts` 由 Better Auth CLI 生成(`pnpm --filter @repo/auth generate`),**不要手改**;业务表另建文件。

### 5.2 @repo/auth — Better Auth

```
packages/auth/
├── server.ts    # auth 实例:drizzleAdapter(pg) + emailAndPassword + nextCookies() + username()
├── index.ts     # "use server" 模块,对外唯一入口(见下)
├── client.ts    # createAuthClient()(better-auth/react): signIn/signUp/signOut/useSession
├── handlers.ts  # toNextJsHandler(auth),server-only,由 app 的 api/auth/[...all].ts 挂载
├── proxy.ts     # authProxy:middleware 辅助,保护 /dashboard(⚠️ 当前未注册、且无该路由)
├── keys.ts      # extends database keys
├── constants.ts # 缓存 tag:user-logout
└── utils/username.ts # generateUsername / getInitials
```

`index.ts` 导出的 Server Actions:

| 函数 | 说明 |
| --- | --- |
| `currentUser()` | 读会话用户。`"use cache: private"` + `cacheTag("user-logout")`,登出时 `revalidateTag` 失效 |
| `signInEmail(email, password)` | 服务端登录,失败返回 null |
| `signUpEmail(name, username, email, password)` | 服务端注册 |
| `signOut()` | 登出并 `revalidateTag(USER_LOGOUT, "max")` |
| `requireAuthenticatedUser(redirectTo)` | 未登录则 redirect |
| `requireUnauthenticatedUser(redirectTo)` | 已登录则 redirect |

### 5.3 @repo/design-system — shadcn/ui 组件库

- `components.json`:style `radix-vega`,RSC 开启,Tailwind v4 CSS 变量,alias 全部指向 `@repo/design-system/*`,图标库 lucide。
- `index.tsx` 导出 `DesignSystemProvider`(next-themes ThemeProvider + TooltipProvider + Toaster);根布局统一包裹。
- 目录:`components/ui/*`(shadcn 生成件,60+),`components/action-button.tsx`、`components/mode-toggle.tsx`(自定义),`lib/utils.ts`(cn)、`lib/fonts.ts`(Geist),`styles/globals.css`(主题变量),`hooks/use-mobile.ts`。
- ⚠️ biome 配置排除了 `components/ui`、`lib`、`hooks`(生成代码不 lint、不手改格式)。
- 使用方式:app 里 `import { Button } from "@repo/design-system/components/ui/button"`。

### 5.4 @repo/next-config — 共享 NextConfig

导出 `config`(NextConfig)与 `withAnalyzer()`:

- `cacheComponents: true`(Next 16 Cache Components,直接影响写页面方式,见第 8 节)。
- images:avif/webp;remotePatterns 含 `img.clerk.com`(上游遗留,可清理)。
- PostHog 反代 rewrites:`/ingest/*` → `us.i.posthog.com`;`skipTrailingSlashRedirect: true` 配套。
- keys:`NEXT_PUBLIC_APP_URL`、`NEXT_PUBLIC_WEB_URL` 必填;⚠️ `NEXT_PUBLIC_PROJECT_PRODUCTION_URL` 实际读取的是 `process.env.PROJECT_PRODUCTION_URL`(命名不一致,设值时注意)。

### 5.5 @repo/product — PostHog 与错误处理

- 客户端:`index.ts` 导出 `product`(posthog-js)与 `parseError(error)`;`instrumentation-client.ts` 的 `initializeAnalytics()` 在 app 的 `instrumentation-client.ts` 中调用。
- 服务端:`server.ts` 导出 `product`(posthog-node,`flushAt: 1`),server-only。登录/注册 action 用它 `identify` 用户。
- `parseError`:规整 message → `captureException` → 返回 message,用于 catch 块。
- `log.ts` 就是 `console`(开源版去掉 Axiom)。
- keys:`NEXT_PUBLIC_POSTHOG_KEY`(必须 `phc_` 开头)、`NEXT_PUBLIC_POSTHOG_HOST`(url)。

### 5.6 @repo/seo — SEO

- `createMetadata({ title, description, image, ...})`:默认模板 + lodash.merge 深合并,产 Metadata。
- ⚠️ 模板里 `applicationName: "next-forge"`、author/publisher 硬编码,做自己品牌要改这里。
- `JsonLd` 组件:JSON-LD(schema-dts),已做 HTML 转义。

### 5.7 @repo/internationalization — 国际化(可用未接入)

- next-international + languine;`dictionaries/`:en(源)、es、de、zh、fr、pt;`languine.json` 定义 locale 与文件匹配;`pnpm translate` 调 languine CLI 机翻。
- 提供 `getDictionary(locale)`、`locales`、`Dictionary` 类型、`internationalizationMiddleware`。
- ⚠️ **当前没有任何 app 使用它**(无 middleware.ts、无 getDictionary 调用)。要启用:在 `apps/app/middleware.ts` 调 `internationalizationMiddleware`,页面里用 `getDictionary`。

### 5.8 @repo/typescript-config

三个预设:`base.json` / `nextjs.json` / `react-library.json`,各包 tsconfig 通过 `extends` 引用。

## 6. 环境变量

**唯一参考文件:`apps/app/.env.example`**(packages/database 没有 .env.example)。

```bash
# Server
DATABASE_URL=""                      # PostgreSQL 连接串(必填,z.url() 校验)

# Client
NEXT_PUBLIC_POSTHOG_KEY=""           # phc_ 开头(必填)
NEXT_PUBLIC_POSTHOG_HOST=""          # PostHog 地址(必填)
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXT_PUBLIC_WEB_URL="http://localhost:3001"
NEXT_PUBLIC_DOCS_URL="http://localhost:3004"   # 仅示例,keys 未校验
```

校验机制(全链路 @t3-oss/env-nextjs,**启动即校验,缺一个直接报错**):

```
app/env.ts = createEnv({ extends: [auth(), analytics(), core(), database()] })
   auth()      → extends database()
   database()  → DATABASE_URL
   analytics() → POSTHOG_KEY / POSTHOG_HOST
   core()      → APP_URL / WEB_URL
```

放置位置:

| 文件 | 作用 |
| --- | --- |
| `apps/app/.env.local` | 应用运行(next dev / next build) |
| `packages/database/.env` | drizzle-kit(migrate/push)读 DATABASE_URL |
| `packages/auth/.env.example` | 仅 DATABASE_URL 说明 |

turbo `globalDependencies: ["**/.env.*local"]`,env 文件变动会使缓存失效;`envMode: "loose"`。

## 7. 常用命令(根目录执行)

```bash
pnpm install                 # 安装依赖(pnpm@10.25.0,Node >= 22)

# 开发
pnpm dev                     # 跑全部 app(dev server,不缓存)
pnpm dev:app                 # app + storybook(studio 不存在会被 turbo 忽略,无害)
pnpm dev:docs                # 文档站
# pnpm dev:web 引用不存在的 web 应用,不要用

# 构建 / 测试 / 分析(按 turbo 依赖拓扑执行)
pnpm build
pnpm test                    # turbo test(vitest)
pnpm analyze                 # build + bundle analyzer

# 代码质量(ultracite = biome 封装)
pnpm check                   # lint 检查(CI 同款)
pnpm fix                     # 自动修复

# 数据库(实际执行 packages/database 下的 drizzle-kit)
pnpm migrate                 # drizzle-kit generate:由 schemas 生成 SQL 迁移
pnpm push                    # drizzle-kit push:直接把 schema 推到数据库

# 认证 schema 再生成(改 better-auth 配置后)
pnpm --filter @repo/auth generate

# 依赖与组件
pnpm bump-deps               # npm-check-updates 全量升级(recharts 除外)
pnpm bump-ui                 # shadcn 全量重装 design-system 组件
npx shadcn@latest add <name> -c packages/design-system   # 增量加组件

# 新建共享包脚手架
pnpm turbo gen init          # 生成 packages/<name>/ 的 package.json + tsconfig 模板

# 清理
pnpm clean                   # git clean -xdf node_modules(危险,会删全部未跟踪文件)
```

端口速查:app `3000` · docs `3002` · storybook `6006`(.env.example 里的 3001/3004 是上游 web/docs 端口,本仓库不适用)。

CI(`.github/workflows/check.yaml`):push/PR → main 时跑 `npm ci && npm run check`。
⚠️ 仓库只有 pnpm-lock.yaml 没有 package-lock.json,`npm ci` 会失败——CI 目前疑似损坏,合码前本地务必 `pnpm check` 自查。dependabot:actions 月度、pnpm 周度。

## 8. 架构约定(开发必须遵守)

1. **环境变量一律走 keys.ts 模式**:新包建 `keys.ts`(`createEnv` + zod 校验),需要它的包 `extends`;应用侧在 `apps/app/env.ts` 的 `extends` 数组里注册。禁止裸读 `process.env`(keys.ts 内部除外)。
2. **服务端专用模块标 `"server-only"`**(如 auth/handlers、product/server),防止客户端意外引入。
3. **Server Actions 三件套**:页面功能按 `actions/index.ts`("use server")+ `schemas/index.ts`(zod 4)+ `components/`(react-hook-form + @hookform/resolvers)组织,参照 sign-in/sign-up 现有实现;错误用 `parseError`。
4. **认证守卫放布局层**:`(authenticated)`/`(unauthenticated)` 路由组 + `requireAuthenticatedUser` / `requireUnauthenticatedUser`(经 `app/actions/auth.ts` 封装,自带 redirect 目标)。不要用 middleware 做会话守卫(auth/proxy.ts 仅是参考实现,未启用)。
5. **Cache Components 已关闭(2026-10-07,vinext 兼容性)**:不要使用 `"use cache"` / `"use cache: private"` / `cacheTag` / `cacheLife` / `revalidateTag(tag, profile)`。动态数据在 server component 里直接 `await`;数据读取一律通过 `getDatabase()`(不再有模块级 `database` 单例)。
6. **UI 只从 design-system 引**:不在 app 里直接装 shadcn / 自己写 ui 基础件;新组件加到 packages/design-system,并在 storybook 补 stories;主题切换用现成 `ModeToggle`。
7. **数据库变更只走 schemas**:业务表新建 `schemas/<name>.ts`(SQLite 方言,`drizzle-orm/sqlite-core`)并在 `schemas/index.ts` 注册;`schemas/auth.ts` 是 Better Auth 四表的 SQLite 手工转换物,禁止手改;流程:`写 schema → pnpm migrate(生成 SQL)→ 应用到 D1(本地注入 / 远程走 API,见第 12 节)`,迁移产物进 `packages/database/drizzle/` 一并提交。
8. **错误上报统一 `parseError`**(客户端、服务端通用);Error Boundary 上报参照 `global-error.tsx`(`product.captureException`)。
9. **包命名 `@repo/*`,内部依赖一律 `workspace:*`**;新建包用 `turbo gen init` 起步,package.json 不带 version/private 按模板。
10. **TypeScript**:strict、type(不用 interface,biome `useConsistentTypeDefinitions`);导出函数具名,barrel file 会被 biome 警告(现有 `export *` 处都带了 biome-ignore 注释,新代码避免)。

## 9. 常见任务 SOP

### A. 新增页面(登录后)

1. 建 `apps/app/app/(authenticated)/<route>/page.tsx`,`export const metadata`(或用 `@repo/seo` 的 `createMetadata`)。
2. 需要数据:server component 里直接 `await database.query.*`;注意约定 5(缓存/动态访问)。
3. 布局自动获得 sidebar,无需额外包裹。

### B. 新增数据表

1. `packages/database/schemas/<name>.ts` 写 pgTable。
2. `packages/database/schemas/index.ts` 注册(`import * as xxx` + 展开进 `schemas`)。
3. `pnpm migrate` → 检查 `packages/database/drizzle/` 生成的 SQL → `pnpm push`。
4. 回滚/重来可删 `drizzle/` 下对应迁移后重新 generate。

### C. 新增登录区功能(表单 + action)

参照 `(unauthenticated)/sign-in/`:schema(zod)→ action("use server",调 `@repo/auth` API,失败 return null,成功 `redirect`)→ form 组件(useActionState/react-hook-form)→ 页面引用。

### D. 新增 UI 组件

```bash
npx shadcn@latest add <component> -c packages/design-system
```
生成到 `packages/design-system/components/ui/`;然后在 `apps/storybook/stories/` 补同名 stories;不要动 biome 排除目录里的生成代码。

### E. 新建共享包

`pnpm turbo gen init` → 生成 `packages/<name>/{package.json,tsconfig.json}` → 按 keys.ts 模式补环境变量(如有)→ 在需要它的 app/env.ts 或依赖方 package.json 注册。

### F. 启用国际化(如需要)

1. `apps/app/middleware.ts`:调 `@repo/internationalization/middleware` 的 `internationalizationMiddleware`。
2. 页面/组件:`getDictionary(locale)` 取文案;词条改动后 `pnpm translate` 同步各语言(需 languine token)。

### G. 本地联调数据库

任意 PostgreSQL(Docker 或远端)→ 写入 `apps/app/.env.local` 与 `packages/database/.env` 的 `DATABASE_URL` → `pnpm push` 建表 → `pnpm dev:app`。

## 10. 已知坑与不符点(重要,遇到问题先对照)

1. **README 与实际不符**:README 写的 apps/web、api、email、docs=Mintlify、Clerk、Stripe、Resend 均为本仓库不存在或未使用的东西;实际三应用(app/docs/storybook),文档站是 Fumadocs,认证是 Better Auth。
2. **scripts/ CLI 面向上游**:next-forge CLI 的 `initialize.ts` 会拷贝 `apps/web`、`apps/api`、`packages/cms` 的 .env.example(本仓库没有),并 clone 上游 `vercel/next-forge`。**不要用这个 CLI 初始化/更新,直接在本仓库开发。**
3. **`pnpm dev:web` 无效**(web 应用不存在);`dev:app` 里的 `studio` filter 会被静默忽略。
4. **auth/proxy.ts 未启用**且保护的 `/dashboard` 路由不存在;实际守卫在布局层(见约定 4)。
5. **`NEXT_PUBLIC_PROJECT_PRODUCTION_URL` 读的是 `process.env.PROJECT_PRODUCTION_URL`**(next-config/keys.ts),变量名不一致。
6. **packages/database 缺 .env.example**,drizzle-kit 需要自备 `packages/database/.env`。
7. **CI 用 `npm ci` 但仓库只有 pnpm-lock.yaml**,check workflow 疑似跑不起来;本地自查用 `pnpm check`。
8. **seo/metadata.ts 硬编码 "next-forge"/Vercel 品牌**,换品牌需改 `packages/seo/metadata.ts`(applicationName/author/publisher)与各 app 的文案。
9. **Node/包管理器**:engines `>=22`,CI Node 24;pnpm 版本由 `packageManager` 锁定(corepack enable 可自动对齐)。Windows 下注意使用 Git Bash 时路径引号。
10. **Zod 4**:校验 API 用新写法(如 `z.url()`、`z.string().email()` 仍可用但新代码优先 `z.email()` 风格),与网上的 zod v3 教程有差异。
11. **国际化包未接入**(见 5.7),别以为页面文案会自动多语言。
12. **design-system 的 biome 排除目录**(`components/ui`、`lib`、`hooks`)内文件不 lint;改动后 `pnpm check` 不会覆盖它们,需自行保证质量。**其中的 `radix-ui` 导入组件必须带 `"use client"` 头(badge/breadcrumb/button-group/button/item/navigation-menu 已加)——漏掉会让统一包 radix-ui 进入 rsc 服务端构建,rolldown 内存爆炸至 20GB+ 后原生崩溃(0xC0000409)**。
13. **pnpm 12**:依赖构建脚本白名单在 `pnpm-workspace.yaml` 的 `allowBuilds`(映射而非列表);workerd/esbuild/sharp 等已放行,新装含构建脚本的包要补。
14. **TS 7**:已移除所有 tsconfig 的 `baseUrl`(TS7 移除了该选项),paths 相对 tsconfig 所在目录解析;`@repo/database` 的导出必须显式类型注解(`DrizzleD1Database<typeof schemas>`),否则 TS7 报"类型不可移植"。
15. **Next 16.3.8**:`next build --port` 已移除(build 无端口概念);`next build` 仍可验证 web/storybook 与类型。
16. **`apps/web` 与 `apps/studio` 实际存在**(web 是 i18n 营销站、studio 是 drizzle-kit studio 工具),与上游 README 描述不同;两者不部署到 Workers。

## 11. 参考链接

- 上游文档(大部分机制通用):https://www.next-forge.com/docs
- Better Auth:https://www.better-auth.com
- Drizzle ORM:https://orm.drizzle.team
- Turborepo:https://turborepo.com
- shadcn/ui:https://ui.shadcn.com
- Ultracite:https://www.ultracite.dev
- Fumadocs:https://fumadocs.dev
- PostHog:https://posthog.com
- next-international:https://next-international.vercel.app
- t3-env:https://env.t3.gg

---

## 12. vinext / Cloudflare Workers 部署(2026-10-07 上线)

### 12.1 线上拓扑(全免费套餐)

| 资源 | 值 |
| --- | --- |
| 主应用 Worker / 域名 | `forge` / **https://forge.3webweb.com** |
| 文档站 Worker / 域名 | `forge-docs` / **https://forge-docs.3webweb.com** |
| 缓存 Worker(app 专用) | `forge-response-store`(service binding,无对外路由) |
| R2 桶 | `forge-response-store-cache-bodies`(APAC) |
| D1 数据库 | `forge-db`(APAC,uuid `7a742070-e1ec-42e6-acd8-41a5b226be46`,binding 名 `DB`) |
| KV(docs 数据缓存) | `VINEXT_KV_CACHE`(部署时自动开通) |
| 账号 | `0ce2869905292483d658d486a6e31a3c`,zone `3webweb.com`(ID `de9b3c4a11288a5bcc8a038569ec83d3`) |
| Secret | `BETTER_AUTH_SECRET`(cf deploy --secrets-file 注入,文件用后即删) |

### 12.2 本地开发(app)

```bash
pnpm install
pnpm --filter app dev:vinext     # vite dev,http://localhost:3001
```

- 本地密钥放 `apps/app/.dev.vars`(`BETTER_AUTH_SECRET=...`,已 gitignore)。
- 本地 D1 状态在 `apps/app/.cloudflare/state/v3/d1/`(vite dev 自动创建;**别在 dev 运行时执行构建,残留进程会锁住 state**)。
- 首次建表:启动 dev → 随便发一个会触库的请求让 miniflare 生成 sqlite 文件 → 停 dev → 用 `node:sqlite`(`node -e`,Node 24 内置)把 `packages/database/drizzle/*.sql` 按 `--> statement-breakpoint` 分段执行进去 → 重启 dev。
- **数据库访问统一 `getDatabase()`**(`@repo/database`),它每次调用从 `cloudflare:workers` 的 `env.DB` 新建 drizzle 实例——不要在模块顶层捕获 binding。
- 环境变量:server 端 secret 走 Worker env(`BETTER_AUTH_SECRET`);`NEXT_PUBLIC_*` 由构建期内联(dev 从 `.env.local` 读)。

### 12.3 构建与部署

```bash
# 主应用(apps/app)
pnpm --filter app build:vinext          # 产出 .cloudflare/output/v0/workers/{default,forge-response-store}
pnpm --filter app deploy:response-store # 部署缓存 Worker(仅其依赖/配置变化时需要)
npx vinext-cloudflare deploy --skip-build --cwd apps/app
# 若 Worker 上声明了新的 secret binding 且尚未设置,改用:
#   1) 生成 .prod-secrets.tmp(BETTER_AUTH_SECRET=xxx)  2) npx cf deploy --prebuilt --mode production --secrets-file .prod-secrets.tmp
#   3) 立即删除该文件

# 文档站(apps/docs)
pnpm --filter docs build:vinext         # = fumadocs-mdx && vite build
npx vinext-cloudflare deploy --skip-build --cwd apps/docs
```

- 域名在各自 `cloudflare.config.ts` 的 `domains` 字段声明,部署时自动挂 Custom Domain(不要手动建 DNS/CNAME)。
- `accountId` 必须在 `defineConfig` **顶层**,放 `worker` 里会校验失败。
- docs 的 ISR 内容需要持久缓存,已配 `kvDataAdapter()` + `VINEXT_KV_CACHE` binding。
- 部署卡死排查:`npx vinext-cloudflare deploy` 若长时间无输出,先杀残留 node 进程再用 `< /dev/null` 重跑。

### 12.4 数据库迁移(远程)

`drizzle-kit generate` 只生成 SQL;应用到远程 D1 走 Cloudflare API:

```
POST /accounts/{account_id}/d1/database/{forge-db uuid}/query   body: { sql }
```

按 `--> statement-breakpoint` 分段逐条执行即可(ER 图变更同样先 generate 后 apply)。

### 12.5 验收清单

- `curl https://forge.3webweb.com/api/auth/ok` → `{"ok":true}`
- 未登录访问 `/` → 307 到 `/sign-in`;注册/登录/登出全流程可用
- `curl -D - https://forge-docs.3webweb.com/docs` → `X-Vinext-Cache: HIT`(二次请求)
- PostHog:`NEXT_PUBLIC_POSTHOG_KEY` 当前为占位值 `phc_dev_placeholder`(见各 app `.env.local`,已 gitignore)——接入真实 PostHog 项目后替换并重新构建部署。

### 12.6 部署踩坑实录(2026-10-07)

1. **radix-ui 统一包 × rsc 环境 = rolldown 内存爆炸**:design-system 组件若缺 `"use client"` 头,统一包 radix-ui 会被拉进服务端 rsc 构建,内存涨到 20GB+ 后原生崩溃(Windows 0xC0000409,无任何 JS 栈)。修复=补 `"use client"`(见第 10 节第 12 条)。调试时用「内存看门狗 + 最小化二分」:构建脚本轮询 node 进程内存、超 6GB 强杀,再逐块加回模块定位。
2. **`@cloudflare/workers-response-store` 必须是 app 的直接依赖**:pnpm 不提升传递依赖,Response Store Worker 的入口 `@cloudflare/workers-response-store/service` 从项目根解析不到,构建期 rolldown 原生崩溃(dev 期则报 500 resolve 错误)。npm 项目靠提升侥幸可用,pnpm 必须显式声明。
3. **Better Auth 路由文件必须 `[...all]/route.ts`**:fork 原来的 `app/api/auth/[...all].ts` 不符合 App Router 约定,所有 /api/auth/* 请求被路由层吞掉 307 到 /sign-in。
4. **fumadocs-mdx 在 vinext 下需要 `fumadocs-mdx/vite` 插件**:`?collection=` MDX 模块无 loader 时 es-module-lexer 直接 parse error;fumadocs-mdx 15+ 官方导出 `./vite` 插件,放进 vite plugins 即可。
5. **ISR 检测会阻断无缓存适配器的部署**:docs 有 ISR 内容时,生产部署强制要求持久缓存(配 KV data adapter 即可)。
6. **Worker 尚不存在时无法预先 `wrangler secret put`**:首次部署带 secret binding 用 `cf deploy --secrets-file <file>`,部署完立即删除文件。
