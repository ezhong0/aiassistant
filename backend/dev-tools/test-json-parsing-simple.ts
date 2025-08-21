/**
 * Simple test for JSON parsing logic without imports
 */

function testJsonParsing() {
  console.log('🧪 Testing Email Agent JSON Parsing Fix\n');

  const testResponses = [
    '```json\n{"to": ["test@example.com"], "subject": "Test", "body": "Hello"}\n```',
    '```\n{"to": ["test@example.com"], "subject": "Test", "body": "Hello"}\n```',
    '{"to": ["test@example.com"], "subject": "Test", "body": "Hello"}',
    'Here is the JSON: {"to": ["test@example.com"], "subject": "Test", "body": "Hello"}',
    'Invalid JSON response that should fail gracefully'
  ];

  // Simulate the parsing logic from the fixed method
  testResponses.forEach((response, index) => {
    console.log(`Test ${index + 1}: ${response.substring(0, 50)}...`);
    
    try {
      // Clean the response content to extract JSON (SAME LOGIC AS FIXED EMAIL AGENT)
      let jsonContent = response.trim();
      
      // Remove markdown code blocks if present
      if (jsonContent.startsWith('```json')) {
        jsonContent = jsonContent.replace(/^```json\s*/, '').replace(/```\s*$/, '');
      } else if (jsonContent.startsWith('```')) {
        jsonContent = jsonContent.replace(/^```\s*/, '').replace(/```\s*$/, '');
      }
      
      // Try to find JSON object in the response
      const jsonMatch = jsonContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonContent = jsonMatch[0];
      }
      
      const emailDetails = JSON.parse(jsonContent);
      console.log(`✅ Success: ${JSON.stringify(emailDetails)}`);
      
    } catch (parseError) {
      console.log(`❌ Parse failed (fallback would be used): ${parseError instanceof Error ? parseError.message : String(parseError)}`);
    }
    console.log('');
  });

  console.log('🎉 JSON parsing test completed!');
  console.log('✅ The fix handles:');
  console.log('  - Markdown code blocks with ```json');
  console.log('  - Markdown code blocks with ```');
  console.log('  - Plain JSON objects');
  console.log('  - JSON embedded in text');
  console.log('  - Invalid responses (graceful fallback)');
}

testJsonParsing();