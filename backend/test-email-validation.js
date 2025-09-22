/**
 * Test script for the new hybrid email validation system
 * Run with: node test-email-validation.js
 */

// Simple test setup since we're using ES modules in a TypeScript project
const { EmailSecurityValidator } = require('./dist/validation/email-security-validator.js');

async function testEmailValidation() {
    console.log('🧪 Testing Email Validation System\n');

    // Test 1: Valid email request
    console.log('Test 1: Valid Email Request');
    EmailSecurityValidator.clearRateLimitData(); // Reset for this test
    const validRequest = {
        to: 'john@example.com',
        subject: 'Meeting Tomorrow',
        body: 'Hi John, let\'s meet tomorrow at 2pm to discuss the project.',
        accessToken: 'valid_token_123'
    };

    const validResult = EmailSecurityValidator.validateSecurity(validRequest, 'user1');
    console.log('✅ Valid Request Result:', {
        isValid: validResult.isValid,
        errors: validResult.errors,
        warnings: validResult.warnings
    });
    console.log('');

    // Test 2: Invalid email format
    console.log('Test 2: Invalid Email Format');
    EmailSecurityValidator.clearRateLimitData(); // Reset for this test
    const invalidEmailRequest = {
        to: 'invalid-email',
        subject: 'Test',
        body: 'Test body',
        accessToken: 'valid_token_123'
    };

    const invalidEmailResult = EmailSecurityValidator.validateSecurity(invalidEmailRequest, 'user2');
    console.log('❌ Invalid Email Result:', {
        isValid: invalidEmailResult.isValid,
        errors: invalidEmailResult.errors
    });
    console.log('');

    // Test 3: Missing required fields
    console.log('Test 3: Missing Required Fields');
    EmailSecurityValidator.clearRateLimitData(); // Reset for this test
    const missingFieldsRequest = {
        to: 'john@example.com',
        subject: '',
        body: '',
        accessToken: ''
    };

    const missingFieldsResult = EmailSecurityValidator.validateSecurity(missingFieldsRequest, 'user3');
    console.log('❌ Missing Fields Result:', {
        isValid: missingFieldsResult.isValid,
        errors: missingFieldsResult.errors
    });
    console.log('');

    // Test 4: Suspicious content
    console.log('Test 4: Suspicious Content');
    EmailSecurityValidator.clearRateLimitData(); // Reset for this test
    const suspiciousRequest = {
        to: 'victim@example.com',
        subject: 'URGENT!!! Click here NOW!!!',
        body: '<script>alert("xss")</script> Click here to claim your $1000000 prize!',
        accessToken: 'valid_token_123'
    };

    const suspiciousResult = EmailSecurityValidator.validateSecurity(suspiciousRequest, 'user4');
    console.log('⚠️ Suspicious Content Result:', {
        isValid: suspiciousResult.isValid,
        errors: suspiciousResult.errors,
        warnings: suspiciousResult.warnings
    });
    console.log('');

    // Test 5: Size limits
    console.log('Test 5: Size Limits');
    EmailSecurityValidator.clearRateLimitData(); // Reset for this test
    const largeSizeRequest = {
        to: 'john@example.com',
        subject: 'A'.repeat(1500), // Exceeds 998 character limit
        body: 'Normal body',
        accessToken: 'valid_token_123'
    };

    const largeSizeResult = EmailSecurityValidator.validateSecurity(largeSizeRequest, 'user5');
    console.log('📏 Size Limit Result:', {
        isValid: largeSizeResult.isValid,
        errors: largeSizeResult.errors
    });
    console.log('');

    // Test 6: Rate limiting
    console.log('Test 6: Rate Limiting');
    console.log('Sending multiple emails rapidly...');

    for (let i = 1; i <= 5; i++) {
        const rateLimitResult = EmailSecurityValidator.validateRateLimit('test_user_rate_limit');
        console.log(`Email ${i}: ${rateLimitResult.isValid ? '✅ Allowed' : '❌ Rate Limited'}`);
        if (!rateLimitResult.isValid) {
            console.log('Rate limit errors:', rateLimitResult.errors);
        }
    }
    console.log('');

    // Test 7: Multiple recipients
    console.log('Test 7: Multiple Recipients');
    EmailSecurityValidator.clearRateLimitData(); // Reset for this test
    const multiRecipientRequest = {
        to: ['john@example.com', 'jane@example.com', 'bob@example.com'],
        subject: 'Team Meeting',
        body: 'Hi team, let\'s meet tomorrow.',
        accessToken: 'valid_token_123'
    };

    const multiRecipientResult = EmailSecurityValidator.validateSecurity(multiRecipientRequest, 'user6');
    console.log('👥 Multiple Recipients Result:', {
        isValid: multiRecipientResult.isValid,
        errors: multiRecipientResult.errors,
        warnings: multiRecipientResult.warnings
    });
    console.log('');

    // Test 8: Blocked domains
    console.log('Test 8: Blocked Domains');
    EmailSecurityValidator.clearRateLimitData(); // Reset for this test
    const blockedDomainRequest = {
        to: 'user@tempmail.org',
        subject: 'Test',
        body: 'Test body',
        accessToken: 'valid_token_123'
    };

    const blockedDomainResult = EmailSecurityValidator.validateSecurity(blockedDomainRequest, 'user7');
    console.log('🚫 Blocked Domain Result:', {
        isValid: blockedDomainResult.isValid,
        errors: blockedDomainResult.errors
    });
    console.log('');

    console.log('🏁 Email Validation Tests Complete!');

    // Clear rate limit data for cleanup
    EmailSecurityValidator.clearRateLimitData();
}

// Run tests
if (require.main === module) {
    testEmailValidation().catch(console.error);
}

module.exports = { testEmailValidation };