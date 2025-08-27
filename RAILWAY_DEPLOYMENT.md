# 🚀 Railway Deployment Guide for AI Assistant

## 🎯 **Current Production Deployment**

**Production URL**: `https://aiassistant-production-5333.up.railway.app`  
**Status**: ✅ **LIVE**  
**Environment**: Production  
**Last Updated**: $(date)

### **Quick Links**
- **Health Check**: [https://aiassistant-production-5333.up.railway.app/health](https://aiassistant-production-5333.up.railway.app/health)
- **API Base**: [https://aiassistant-production-5333.up.railway.app/api](https://aiassistant-production-5333.up.railway.app/api)
- **Assistant Endpoint**: [https://aiassistant-production-5333.up.railway.app/api/assistant](https://aiassistant-production-5333.up.railway.app/api/assistant)

---

## Quick Deploy (5 Minutes)

### 1. Install Railway CLI
```bash
npm install -g @railway/cli
# or
curl -fsSL https://railway.app/install.sh | sh
```

### 2. Login to Railway
```bash
railway login
```

### 3. Initialize & Deploy
```bash
# From your project root
railway init
railway up
```

### 4. Set Environment Variables
```bash
railway variables set NODE_ENV=production
railway variables set JWT_SECRET="your-super-secret-jwt-key-32-chars-minimum"
railway variables set OPENAI_API_KEY="your-openai-key"
railway variables set GOOGLE_CLIENT_ID="your-google-client-id"
railway variables set GOOGLE_CLIENT_SECRET="your-google-client-secret"
railway variables set GOOGLE_REDIRECT_URI="https://aiassistant-production-5333.up.railway.app/auth/google/callback"

# Slack Configuration (when ready)
railway variables set SLACK_SIGNING_SECRET="your-slack-signing-secret"
railway variables set SLACK_BOT_TOKEN="xoxb-your-bot-token"
railway variables set SLACK_CLIENT_ID="your-slack-client-id"
railway variables set SLACK_CLIENT_SECRET="your-slack-client-secret"
railway variables set SLACK_OAUTH_REDIRECT_URI="https://aiassistant-production-5333.up.railway.app/slack/oauth/callback"
```

### 5. Get Your Production URL
```bash
railway domain
# Returns: https://aiassistant-production-5333.up.railway.app
```

## 🎯 Slack Integration URLs

Once deployed, use these **permanent URLs** in your Slack App:

```
Base URL: https://aiassistant-production-5333.up.railway.app

Event Subscriptions:    https://aiassistant-production-5333.up.railway.app/slack/events
Slash Commands:         https://aiassistant-production-5333.up.railway.app/slack/commands
Interactivity:          https://aiassistant-production-5333.up.railway.app/slack/interactive
OAuth Redirect:         https://aiassistant-production-5333.up.railway.app/slack/oauth/callback
App Installation:       https://aiassistant-production-5333.up.railway.app/slack/install
Health Check:           https://aiassistant-production-5333.up.railway.app/slack/health
```

## 🔧 Development Workflow

### Production Deployment Management
```bash
# View current production status
railway status

# View production logs
railway logs --tail

# Deploy updates to production
railway up

# Open production app in browser
railway open

# Check production environment variables
railway variables
```

### Local Development
```bash
# Run locally
cd backend && npm run dev

# Deploy to Railway
railway up

# View logs
railway logs

# Open in browser
railway open
```

### Environment Management
```bash
# View all variables
railway variables

# Set new variable
railway variables set KEY=value

# Delete variable
railway variables delete KEY
```

## 📊 Monitoring & Maintenance

### View Application Metrics
```bash
railway status
railway logs --tail
```

### Custom Domain (Optional)
```bash
railway domain add yourdomain.com
```

## 🚀 Production Checklist

### **Current Status** ✅
- [x] **Production URL**: `https://aiassistant-production-5333.up.railway.app`
- [x] **Environment variables set**
- [x] **Health check endpoint working**: `/health`
- [x] **SSL certificate auto-configured**
- [x] **Monitoring and logs accessible**

### **Next Steps** 🔄
- [ ] **Slack URLs updated** in app settings with production URLs
- [ ] **Slack integration tested** in production environment
- [ ] **Custom domain configured** (optional)
- [ ] **Performance monitoring** set up
- [ ] **Backup strategy** implemented

## 💰 Cost Estimate

- **Hobby Plan**: $5/month (perfect for MVP)
- **Pro Plan**: $20/month (for scaling)
- **Free Tier**: $5 credit monthly (good for testing)

## 🔍 Troubleshooting

### Build Issues
```bash
# Check build logs
railway logs --deployment

# Rebuild and deploy
railway up --detach
```

### Environment Issues
```bash
# Verify environment variables
railway run env
```

### Health Check Failures
- Verify `/health` endpoint returns 200
- Check that your app starts on `process.env.PORT`
- Review application logs for startup errors

## 🎉 Success Metrics

Once deployed successfully:
- ✅ Permanent URLs (no more ngrok changes!)  
- ✅ Professional deployment ready for beta users
- ✅ SSL/HTTPS automatically configured
- ✅ Slack App Directory submission ready
- ✅ Auto-deploy from git commits
- ✅ Built-in monitoring and logs

**Your AI Assistant is now production-ready!** 🚀