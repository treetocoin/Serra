# Netlify Deployment Guide

This guide walks you through deploying the Greenhouse Management System frontend to Netlify.

---

## Prerequisites

1. **GitHub Repository**: Your code must be in a GitHub repository
2. **Netlify Account**: Sign up at https://netlify.com (free tier works)
3. **Supabase Project**: Your Supabase project should be set up and running

---

## Step 1: Prepare Your Repository

Ensure your repository has the following structure:

```
/frontend
  /src
  /public
  package.json
  vite.config.ts
  index.html
```

### Verify Build Script

Check that `package.json` has the correct build script:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  }
}
```

---

## Step 2: Connect GitHub to Netlify

1. Log in to https://app.netlify.com
2. Click **Add new site** → **Import an existing project**
3. Choose **GitHub** as your provider
4. Authorize Netlify to access your GitHub account
5. Select your repository

---

## Step 3: Configure Build Settings

In the Netlify deploy configuration:

| Setting | Value |
|---------|-------|
| **Base directory** | `frontend` |
| **Build command** | `npm run build` |
| **Publish directory** | `frontend/dist` |

Click **Deploy site** (we'll add environment variables next)

---

## Step 4: Add Environment Variables

1. In your Netlify site dashboard, go to **Site settings** → **Environment variables**
2. Click **Add a variable** and add the following:

### Required Variables

| Key | Value | Where to find it |
|-----|-------|------------------|
| `VITE_SUPABASE_URL` | `https://your-project.supabase.co` | Supabase Dashboard → Settings → API |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbG...` (long string) | Supabase Dashboard → Settings → API → anon public key |

### Example:

```
Key: VITE_SUPABASE_URL
Value: https://abcdefghijklmnop.supabase.co

Key: VITE_SUPABASE_ANON_KEY
Value: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFz...
```

3. Click **Save**

---

## Step 5: Trigger Redeploy

After adding environment variables:

1. Go to **Deploys** tab
2. Click **Trigger deploy** → **Deploy site**
3. Wait for build to complete (usually 1-2 minutes)

---

## Step 6: Verify Deployment

1. Once deployed, Netlify will provide a URL like: `https://your-site-name.netlify.app`
2. Click the URL to open your application
3. Test the following:
   - ✅ Homepage loads
   - ✅ Login/Register works
   - ✅ Can create devices
   - ✅ Sensors display correctly
   - ✅ Historical data loads

---

## Step 7: Custom Domain (Optional)

### Add a Custom Domain

1. In Netlify dashboard, go to **Domain settings**
2. Click **Add custom domain**
3. Enter your domain (e.g., `greenhouse.yourdomain.com`)
4. Follow instructions to:
   - Add CNAME record to your DNS provider
   - Or use Netlify DNS

### Enable HTTPS

Netlify automatically provisions SSL certificates via Let's Encrypt:

1. Go to **Domain settings** → **HTTPS**
2. Wait for certificate provisioning (usually automatic)
3. Enable **Force HTTPS** to redirect all HTTP traffic

---

## Continuous Deployment

Once connected, Netlify automatically deploys when you push to GitHub:

1. Make changes to your code
2. Commit and push to GitHub:
   ```bash
   git add .
   git commit -m "Update feature"
   git push origin main
   ```
3. Netlify automatically builds and deploys
4. Check **Deploys** tab for build status

### Deploy Previews

Netlify creates preview deployments for pull requests:

1. Create a new branch: `git checkout -b feature-branch`
2. Make changes and push
3. Open a pull request on GitHub
4. Netlify will create a preview URL
5. Test changes before merging

---

## Troubleshooting

### Build Fails

**Error**: `Module not found`
- **Solution**: Ensure all dependencies are in `package.json`
- Run `npm install` locally to verify

**Error**: `Environment variable not found`
- **Solution**: Double-check environment variables in Netlify dashboard
- Ensure they start with `VITE_` prefix

### App Loads But Features Don't Work

**Symptom**: Login fails, no data loads
- **Solution**: Check browser console for errors
- Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are correct
- Check Supabase API settings

### Blank Page After Deployment

**Symptom**: Page loads but shows blank screen
- **Solution**: Check base URL in `vite.config.ts`
- Ensure `build` folder is set to `dist`
- Check browser console for errors

---

## Monitoring and Analytics

### Netlify Analytics (Optional)

1. Go to **Site settings** → **Analytics**
2. Enable **Netlify Analytics** ($9/month)
3. View pageviews, unique visitors, top pages

### Custom Error Pages

Create custom 404 page:

1. Create `frontend/public/_redirects` with:
   ```
   /*    /index.html   200
   ```
2. This enables client-side routing for React Router

---

## Performance Optimization

### Enable Caching

Netlify automatically sets cache headers for static assets.

### Asset Optimization

1. **Images**: Compress images before committing
2. **Code splitting**: Vite handles this automatically
3. **Tree shaking**: Enabled by default in production builds

### Enable Brotli Compression

Netlify automatically compresses assets with Brotli and gzip.

---

## Security Best Practices

1. **Never commit secrets**: Keep API keys in environment variables only
2. **Use HTTPS**: Always force HTTPS in production
3. **Row Level Security**: Ensure Supabase RLS policies are properly configured
4. **CORS**: Configure Supabase to only allow requests from your Netlify domain

---

## Rollback Deployment

If a deployment breaks production:

1. Go to **Deploys** tab
2. Find the last working deployment
3. Click **...** → **Publish deploy**
4. Site will immediately rollback

---

## Summary

Your Greenhouse Management System is now deployed! 🎉

- **Production URL**: `https://your-site-name.netlify.app`
- **Auto-deploys**: Enabled on push to main
- **Environment variables**: Configured
- **SSL**: Enabled

Next steps:
- Configure custom domain (optional)
- Set up monitoring/analytics
- Test with ESP32 devices
