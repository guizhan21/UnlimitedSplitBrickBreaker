# Deployment

This project is deploy-ready for GitHub + Vercel automatic deployment.

```powershell
cd D:\Codex_Web_Games\UnlimitedSplitBrickBreaker
pnpm install
pnpm run build
pnpm run lint
pnpm exec tsc --noEmit
```

## GitHub Flow

Initialize and push the project after Git is available:

```powershell
git init
git branch -M main
git add .
git commit -m "Deployable Next.js brick breaker"
git remote add origin <github-repo-url>
git push -u origin main
```

After pushing, import the GitHub repository in Vercel and use the default Next.js settings:

- Framework preset: Next.js
- Install command: `pnpm install`
- Build command: `pnpm run build`
- Output directory: `.next`

No required environment variables are used.

## Ongoing Auto Deploy Rule

After Vercel is connected to GitHub, do not deploy with `vercel --prod` for normal updates.
For every code change:

```powershell
pnpm run build
pnpm run lint
pnpm exec tsc --noEmit
git add .
git commit -m "<change summary>"
git push
```

Vercel will deploy automatically from the GitHub push.
