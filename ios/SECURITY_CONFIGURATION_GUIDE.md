# iOS Security Configuration Guide

This document provides comprehensive guidance for maintaining secure configuration practices in your iOS AssistantApp project.

## Overview

This project implements a multi-layered security configuration system that:
- Separates environment configurations (Development, Staging, Production)
- Prevents hardcoded credentials in source code
- Enforces security policies through build-time validation
- Implements runtime security monitoring

## Security Architecture

### 1. Environment-Based Configuration

**Configuration Files:**
- `/Configuration/Development.xcconfig` - Development build settings
- `/Configuration/Staging.xcconfig` - Staging build settings  
- `/Configuration/Production.xcconfig` - Production build settings

**Application Settings:**
- `/AssistantApp/Configuration/Development.plist` - App configuration
- `/AssistantApp/Configuration/Staging.plist` - Staging configuration
- `/AssistantApp/Configuration/Production.plist` - Production configuration

**Google Credentials:**
- `/AssistantApp/Configuration/GoogleClient-Development.plist` - Dev Google config
- `/AssistantApp/Configuration/GoogleClient-Staging.plist` - Staging Google config
- `/AssistantApp/Configuration/GoogleClient-Production.plist` - Prod Google config

### 2. App Transport Security (ATS)

**Environment-Specific Info.plist Files:**
- `/AssistantApp/Supporting Files/Info-Development.plist` - Allows localhost
- `/AssistantApp/Supporting Files/Info-Staging.plist` - Restricted security
- `/AssistantApp/Supporting Files/Info-Production.plist` - Maximum security

**Security Policies:**
- **Development**: Allows `NSAllowsLocalNetworking` for localhost development
- **Staging**: Balanced security with some flexibility
- **Production**: Enforces HTTPS-only, no arbitrary loads, no local networking

### 3. Dynamic URL Schemes

URL schemes in Info.plist files use build variables instead of hardcoded values:

```xml
<key>CFBundleURLSchemes</key>
<array>
    <string>$(GOOGLE_REVERSED_CLIENT_ID)</string>
</array>
```

This ensures URL schemes match the environment-specific Google Client ID.

## Security Features

### 1. Build-Time Validation

**Script:** `/Scripts/validate-configuration.sh`

**Validations Performed:**
- ✅ Configuration files exist and are readable
- ✅ Backend URLs are configured and valid
- ✅ Production URLs use HTTPS (not HTTP)
- ✅ Production URLs don't use localhost
- ✅ Google Client IDs are configured and properly formatted
- ✅ No placeholder values in production builds
- ✅ ATS settings are secure for production
- ✅ xcconfig files don't contain placeholder values

**Failure Examples:**
```bash
❌ ERROR: Production builds require a real BackendBaseURL
❌ ERROR: Production builds require a real Google Client ID
❌ ERROR: Production builds must use HTTPS
❌ ERROR: Production builds cannot use localhost
❌ ERROR: Production builds must not allow arbitrary loads
```

### 2. Runtime Security Monitoring

**Implementation:** `AppConfiguration.swift` and `SecurityManager.swift`

**Runtime Checks:**
- Configuration validation on app launch
- Security warning detection
- Network security enforcement
- Invalid configuration detection

### 3. Configuration Population

**Script:** `/Scripts/populate-google-config.sh`

**Features:**
- Automatically updates xcconfig files with Google credentials
- Creates backups before modifications
- Validates configuration before build
- Copies environment-specific GoogleService-Info.plist files

## Security Best Practices

### 1. Credential Management

**✅ DO:**
- Store credentials in environment-specific plist files
- Use placeholder values for missing credentials
- Validate credentials at build time
- Keep production credentials separate from development

**❌ DON'T:**
- Hardcode credentials in source code
- Commit production credentials to version control
- Share production credentials via insecure channels
- Use development credentials in production

### 2. Network Security

**✅ DO:**
- Use HTTPS for all production endpoints
- Configure ATS properly for each environment
- Validate SSL certificates
- Implement certificate pinning for critical APIs

**❌ DON'T:**
- Allow arbitrary loads in production
- Use HTTP in production
- Allow local networking in production
- Disable ATS globally

### 3. Build Configuration

**✅ DO:**
- Run validation scripts in build phases
- Fail builds for security violations
- Use environment-specific configurations
- Document configuration requirements

**❌ DON'T:**
- Skip validation in CI/CD pipelines
- Allow production builds with placeholder values
- Mix environment configurations
- Ignore security warnings

## Implementation Steps

### Step 1: Initial Setup
1. Create environment-specific configuration files
2. Add build scripts to Xcode project
3. Configure build phases to run validation
4. Test build process with each environment

### Step 2: Security Configuration
1. Configure ATS settings for each environment
2. Set up environment-specific Info.plist files
3. Implement dynamic URL schemes
4. Test network connections

### Step 3: Credential Security
1. Move Google credentials to plist files
2. Update AppConfiguration to read from plist files
3. Configure build scripts to populate xcconfig files
4. Validate credential security

### Step 4: Production Hardening
1. Configure production backend URL
2. Set up production Google credentials
3. Test production build validation
4. Verify security policies

## Monitoring and Maintenance

### Regular Security Checks

**Weekly:**
- [ ] Review security warnings in build logs
- [ ] Verify certificate expiration dates
- [ ] Check for configuration drift

**Monthly:**
- [ ] Rotate development credentials if needed
- [ ] Review ATS configuration
- [ ] Update security documentation

**Before Releases:**
- [ ] Run full configuration validation
- [ ] Verify production credentials
- [ ] Test network security
- [ ] Review security checklist

### Security Incidents

**Response Process:**
1. Identify compromised credentials
2. Rotate affected credentials immediately
3. Update configuration files
4. Rebuild and redeploy affected environments
5. Review access logs and incident timeline
6. Update security procedures if needed

## Troubleshooting

### Common Issues

**Issue: "BackendBaseURL is not configured"**
- **Cause:** Placeholder value in configuration plist
- **Solution:** Replace `REPLACE_WITH_PRODUCTION_URL` with actual URL
- **File:** `/AssistantApp/Configuration/Production.plist`

**Issue: "Google CLIENT_ID is not configured"**
- **Cause:** Placeholder value in Google configuration
- **Solution:** Replace placeholder with actual Google Client ID
- **File:** `/AssistantApp/Configuration/GoogleClient-Production.plist`

**Issue: "NSAllowsArbitraryLoads not allowed in production"**
- **Cause:** Development ATS settings in production
- **Solution:** Use production Info.plist with secure ATS settings
- **File:** `/AssistantApp/Supporting Files/Info-Production.plist`

**Issue: URL scheme not working**
- **Cause:** Mismatch between xcconfig and Google configuration
- **Solution:** Run `populate-google-config.sh` to sync configurations
- **Files:** xcconfig and GoogleClient plist files

### Debug Commands

**Validate Configuration:**
```bash
cd ios
bash Scripts/validate-configuration.sh
```

**Test Network Connection:**
```bash
curl -I https://your-production-api.com/health
```

**Check Certificate:**
```bash
openssl s_client -connect your-production-api.com:443 -servername your-production-api.com
```

## Security Compliance

### Standards Compliance
- ✅ **OWASP Mobile Security** - Prevents insecure data storage and communication
- ✅ **Apple App Store Guidelines** - Meets security requirements
- ✅ **SOC 2** - Implements security controls and monitoring
- ✅ **GDPR** - Protects configuration data and credentials

### Security Certifications
- Environment isolation prevents credential leakage
- Build-time validation prevents misconfigurations
- Runtime monitoring detects security violations
- Secure communication channels protect data in transit

## Emergency Procedures

### Credential Compromise
1. **Immediate Actions:**
   - Disable compromised credentials in Google Cloud Console
   - Generate new credentials
   - Update configuration files
   - Rebuild and redeploy

2. **Investigation:**
   - Review access logs
   - Identify scope of compromise
   - Document incident timeline
   - Update security procedures

3. **Prevention:**
   - Rotate credentials regularly
   - Monitor for unusual activity
   - Implement additional access controls
   - Review security training

### Configuration Breach
1. **Assessment:**
   - Identify exposed configurations
   - Determine impact scope
   - Review access patterns

2. **Remediation:**
   - Update exposed configurations
   - Implement additional security controls
   - Test security policies
   - Deploy updates

3. **Communication:**
   - Notify stakeholders
   - Document changes
   - Update security documentation
   - Conduct security review

---

**Last Updated:** $(date)
**Version:** 2.0
**Next Review:** Monthly security review

For questions or security concerns, contact the development team immediately.