/**
 * HTML Report Generator for E2E Tests
 *
 * Generates human-readable HTML reports showing:
 * - Inbox configuration and statistics
 * - Test results and performance metrics
 * - API call traces
 * - Sample emails generated
 */

import * as fs from 'fs';
import * as path from 'path';
import { InboxData, Email } from '../generators/whole-inbox-generator';
import { ApiCallRecord } from '../mocks/unified-mock-manager';

export interface TestResult {
  name: string;
  passed: boolean;
  userQuery: string;
  response: string;
  executionTime: number;
  tokensUsed?: number;
  apiCalls: ApiCallRecord[];
  error?: string;
}

export interface ReportData {
  title: string;
  inboxData: InboxData;
  testResults: TestResult[];
  timestamp: Date;
  totalDuration: number;
}

export class E2EHTMLReporter {
  private reportDir: string;

  constructor(reportDir: string = 'tests/e2e/reports/html') {
    this.reportDir = reportDir;
  }

  /**
   * Generate HTML report from test results
   */
  generateReport(data: ReportData): string {
    const {
      title,
      inboxData,
      testResults,
      timestamp,
      totalDuration
    } = data;

    const passedTests = testResults.filter(t => t.passed).length;
    const failedTests = testResults.filter(t => !t.passed).length;
    const totalTests = testResults.length;
    const successRate = totalTests > 0 ? ((passedTests / totalTests) * 100).toFixed(1) : '0';

    const totalApiCalls = testResults.reduce((sum, test) => sum + test.apiCalls.length, 0);
    const avgExecutionTime = totalTests > 0
      ? (testResults.reduce((sum, test) => sum + test.executionTime, 0) / totalTests).toFixed(0)
      : '0';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.escapeHtml(title)} - E2E Test Report</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      line-height: 1.6;
      color: #333;
      background: #f5f7fa;
      padding: 20px;
    }

    .container {
      max-width: 1400px;
      margin: 0 auto;
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      overflow: hidden;
    }

    header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px 40px;
    }

    h1 {
      font-size: 32px;
      margin-bottom: 10px;
    }

    .timestamp {
      opacity: 0.9;
      font-size: 14px;
    }

    .content {
      padding: 40px;
    }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 40px;
    }

    .summary-card {
      background: #f8f9fa;
      padding: 20px;
      border-radius: 8px;
      border-left: 4px solid #667eea;
    }

    .summary-card.success {
      border-left-color: #10b981;
    }

    .summary-card.failure {
      border-left-color: #ef4444;
    }

    .summary-card.info {
      border-left-color: #3b82f6;
    }

    .summary-label {
      font-size: 12px;
      text-transform: uppercase;
      color: #6b7280;
      font-weight: 600;
      margin-bottom: 8px;
    }

    .summary-value {
      font-size: 28px;
      font-weight: 700;
      color: #1f2937;
    }

    .summary-subtext {
      font-size: 14px;
      color: #6b7280;
      margin-top: 4px;
    }

    .section {
      margin-bottom: 40px;
    }

    .section-title {
      font-size: 24px;
      margin-bottom: 20px;
      padding-bottom: 10px;
      border-bottom: 2px solid #e5e7eb;
      color: #1f2937;
    }

    .inbox-stats {
      background: #f8f9fa;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 20px;
    }

    .inbox-stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 15px;
    }

    .inbox-stat {
      display: flex;
      flex-direction: column;
    }

    .inbox-stat-label {
      font-size: 12px;
      color: #6b7280;
      margin-bottom: 4px;
    }

    .inbox-stat-value {
      font-size: 20px;
      font-weight: 600;
      color: #1f2937;
    }

    .test-result {
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 20px;
      transition: transform 0.2s, box-shadow 0.2s;
    }

    .test-result:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }

    .test-result.passed {
      border-left: 4px solid #10b981;
    }

    .test-result.failed {
      border-left: 4px solid #ef4444;
    }

    .test-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 15px;
    }

    .test-name {
      font-size: 18px;
      font-weight: 600;
      color: #1f2937;
      flex: 1;
    }

    .test-badge {
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
    }

    .test-badge.passed {
      background: #d1fae5;
      color: #065f46;
    }

    .test-badge.failed {
      background: #fee2e2;
      color: #991b1b;
    }

    .test-query {
      background: #f3f4f6;
      padding: 12px;
      border-radius: 6px;
      font-family: 'Courier New', monospace;
      font-size: 14px;
      margin-bottom: 15px;
      color: #374151;
    }

    .test-response {
      background: #f9fafb;
      padding: 15px;
      border-radius: 6px;
      margin-bottom: 15px;
      border-left: 3px solid #667eea;
    }

    .test-response-label {
      font-size: 12px;
      text-transform: uppercase;
      color: #6b7280;
      font-weight: 600;
      margin-bottom: 8px;
    }

    .test-response-text {
      color: #1f2937;
      line-height: 1.6;
    }

    .test-error {
      background: #fef2f2;
      border: 1px solid #fecaca;
      padding: 15px;
      border-radius: 6px;
      margin-bottom: 15px;
      color: #991b1b;
    }

    .test-metrics {
      display: flex;
      gap: 20px;
      flex-wrap: wrap;
      margin-bottom: 15px;
    }

    .metric {
      display: flex;
      flex-direction: column;
    }

    .metric-label {
      font-size: 11px;
      text-transform: uppercase;
      color: #6b7280;
      margin-bottom: 4px;
    }

    .metric-value {
      font-size: 16px;
      font-weight: 600;
      color: #1f2937;
    }

    .api-calls {
      margin-top: 15px;
    }

    .api-calls-title {
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 10px;
      color: #374151;
    }

    .api-call {
      background: #f9fafb;
      border-left: 3px solid #3b82f6;
      padding: 12px;
      margin-bottom: 8px;
      border-radius: 4px;
      font-size: 13px;
    }

    .api-call-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 6px;
    }

    .api-call-client {
      font-weight: 600;
      color: #1f2937;
    }

    .api-call-duration {
      color: #6b7280;
      font-size: 12px;
    }

    .api-call-endpoint {
      font-family: 'Courier New', monospace;
      color: #374151;
      font-size: 12px;
    }

    .email-samples {
      margin-top: 20px;
    }

    .email-sample {
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 15px;
    }

    .email-subject {
      font-size: 16px;
      font-weight: 600;
      color: #1f2937;
      margin-bottom: 10px;
    }

    .email-meta {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 10px;
      margin-bottom: 10px;
      font-size: 13px;
    }

    .email-meta-item {
      color: #6b7280;
    }

    .email-meta-label {
      font-weight: 600;
      color: #374151;
    }

    .email-labels {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      margin-top: 10px;
    }

    .label-badge {
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 500;
      background: #e5e7eb;
      color: #374151;
    }

    .label-badge.unread {
      background: #dbeafe;
      color: #1e40af;
    }

    .label-badge.important {
      background: #fef3c7;
      color: #92400e;
    }

    .email-snippet {
      margin-top: 10px;
      padding: 12px;
      background: #f9fafb;
      border-radius: 4px;
      font-size: 13px;
      color: #4b5563;
      font-style: italic;
    }

    footer {
      background: #f3f4f6;
      padding: 20px 40px;
      text-align: center;
      color: #6b7280;
      font-size: 14px;
    }

    .collapsible {
      cursor: pointer;
      user-select: none;
    }

    .collapsible::before {
      content: '▼ ';
      display: inline-block;
      margin-right: 6px;
      transition: transform 0.3s;
    }

    .collapsible.collapsed::before {
      transform: rotate(-90deg);
    }

    .collapsible-content {
      max-height: 1000px;
      overflow: hidden;
      transition: max-height 0.3s ease-out;
    }

    .collapsible-content.collapsed {
      max-height: 0;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>${this.escapeHtml(title)}</h1>
      <div class="timestamp">Generated on ${timestamp.toLocaleString()}</div>
    </header>

    <div class="content">
      <!-- Summary Section -->
      <div class="summary-grid">
        <div class="summary-card success">
          <div class="summary-label">Passed Tests</div>
          <div class="summary-value">${passedTests}</div>
          <div class="summary-subtext">${successRate}% success rate</div>
        </div>

        <div class="summary-card failure">
          <div class="summary-label">Failed Tests</div>
          <div class="summary-value">${failedTests}</div>
          <div class="summary-subtext">of ${totalTests} total tests</div>
        </div>

        <div class="summary-card info">
          <div class="summary-label">API Calls</div>
          <div class="summary-value">${totalApiCalls}</div>
          <div class="summary-subtext">total requests made</div>
        </div>

        <div class="summary-card info">
          <div class="summary-label">Avg Time</div>
          <div class="summary-value">${avgExecutionTime}<span style="font-size: 18px;">ms</span></div>
          <div class="summary-subtext">per test execution</div>
        </div>
      </div>

      <!-- Inbox Configuration Section -->
      <div class="section">
        <h2 class="section-title">Inbox Configuration</h2>
        <div class="inbox-stats">
          <div class="inbox-stats-grid">
            <div class="inbox-stat">
              <div class="inbox-stat-label">User Role</div>
              <div class="inbox-stat-value">${this.escapeHtml(inboxData.metadata.userProfile.role)}</div>
            </div>
            <div class="inbox-stat">
              <div class="inbox-stat-label">Industry</div>
              <div class="inbox-stat-value">${this.escapeHtml(inboxData.metadata.userProfile.industry)}</div>
            </div>
            <div class="inbox-stat">
              <div class="inbox-stat-label">Total Emails</div>
              <div class="inbox-stat-value">${inboxData.emails.length}</div>
            </div>
            <div class="inbox-stat">
              <div class="inbox-stat-label">Calendar Events</div>
              <div class="inbox-stat-value">${inboxData.calendar.length}</div>
            </div>
            <div class="inbox-stat">
              <div class="inbox-stat-label">Time Range</div>
              <div class="inbox-stat-value">${this.formatDateShort(inboxData.metadata.timeRange.start)}</div>
            </div>
            <div class="inbox-stat">
              <div class="inbox-stat-label">Communication Style</div>
              <div class="inbox-stat-value">${this.escapeHtml(inboxData.metadata.userProfile.communicationStyle)}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Test Results Section -->
      <div class="section">
        <h2 class="section-title">Test Results</h2>
        ${testResults.map((result, index) => this.renderTestResult(result, index)).join('')}
      </div>

      <!-- Email Samples Section -->
      <div class="section">
        <h2 class="section-title collapsible" onclick="toggleCollapse('email-samples')">
          Email Samples (First 5)
        </h2>
        <div id="email-samples" class="collapsible-content">
          <div class="email-samples">
            ${inboxData.emails.slice(0, 5).map(email => this.renderEmailSample(email)).join('')}
          </div>
        </div>
      </div>
    </div>

    <footer>
      E2E Test Report · Generated by WholeInboxGenerator · Total Duration: ${(totalDuration / 1000).toFixed(2)}s
    </footer>
  </div>

  <script>
    function toggleCollapse(id) {
      const element = document.getElementById(id);
      const trigger = element.previousElementSibling;
      element.classList.toggle('collapsed');
      trigger.classList.toggle('collapsed');
    }

    // Collapse email samples by default
    window.addEventListener('load', () => {
      const emailSamples = document.getElementById('email-samples');
      const trigger = emailSamples.previousElementSibling;
      emailSamples.classList.add('collapsed');
      trigger.classList.add('collapsed');
    });
  </script>
</body>
</html>`;
  }

  /**
   * Render individual test result
   */
  private renderTestResult(result: TestResult, index: number): string {
    const statusClass = result.passed ? 'passed' : 'failed';
    const statusBadge = result.passed ? 'passed' : 'failed';

    return `
    <div class="test-result ${statusClass}">
      <div class="test-header">
        <div class="test-name">Test #${index + 1}: ${this.escapeHtml(result.name)}</div>
        <div class="test-badge ${statusBadge}">${statusBadge}</div>
      </div>

      <div class="test-query">
        <strong>Query:</strong> "${this.escapeHtml(result.userQuery)}"
      </div>

      ${result.error ? `
        <div class="test-error">
          <strong>Error:</strong> ${this.escapeHtml(result.error)}
        </div>
      ` : ''}

      <div class="test-response">
        <div class="test-response-label">Response</div>
        <div class="test-response-text">${this.escapeHtml(result.response.substring(0, 500))}${result.response.length > 500 ? '...' : ''}</div>
      </div>

      <div class="test-metrics">
        <div class="metric">
          <div class="metric-label">Execution Time</div>
          <div class="metric-value">${result.executionTime}ms</div>
        </div>
        <div class="metric">
          <div class="metric-label">API Calls</div>
          <div class="metric-value">${result.apiCalls.length}</div>
        </div>
        ${result.tokensUsed ? `
        <div class="metric">
          <div class="metric-label">Tokens Used</div>
          <div class="metric-value">${result.tokensUsed}</div>
        </div>
        ` : ''}
      </div>

      ${result.apiCalls.length > 0 ? `
      <div class="api-calls">
        <div class="api-calls-title collapsible" onclick="toggleCollapse('api-calls-${index}')">
          API Calls (${result.apiCalls.length})
        </div>
        <div id="api-calls-${index}" class="collapsible-content collapsed">
          ${result.apiCalls.map(call => this.renderApiCall(call)).join('')}
        </div>
      </div>
      ` : ''}
    </div>`;
  }

  /**
   * Render API call trace
   */
  private renderApiCall(call: ApiCallRecord): string {
    return `
    <div class="api-call">
      <div class="api-call-header">
        <span class="api-call-client">${this.escapeHtml(call.clientName)}</span>
        <span class="api-call-duration">${call.duration}ms</span>
      </div>
      <div class="api-call-endpoint">
        ${this.escapeHtml(call.request.method)} ${this.escapeHtml(call.request.endpoint)}
      </div>
    </div>`;
  }

  /**
   * Render email sample
   */
  private renderEmailSample(email: Email): string {
    const subject = this.getHeaderValue(email, 'Subject');
    const from = this.getHeaderValue(email, 'From');
    const date = this.getHeaderValue(email, 'Date');

    return `
    <div class="email-sample">
      <div class="email-subject">${this.escapeHtml(subject)}</div>
      <div class="email-meta">
        <div class="email-meta-item">
          <span class="email-meta-label">From:</span> ${this.escapeHtml(from)}
        </div>
        <div class="email-meta-item">
          <span class="email-meta-label">Date:</span> ${this.escapeHtml(date)}
        </div>
        <div class="email-meta-item">
          <span class="email-meta-label">ID:</span> ${this.escapeHtml(email.id)}
        </div>
      </div>
      <div class="email-labels">
        ${email.labelIds.map(label => {
          const labelClass = label === 'UNREAD' ? 'unread' : label === 'IMPORTANT' ? 'important' : '';
          return `<span class="label-badge ${labelClass}">${label}</span>`;
        }).join('')}
      </div>
      <div class="email-snippet">${this.escapeHtml(email.snippet)}</div>
    </div>`;
  }

  /**
   * Get header value from email
   */
  private getHeaderValue(email: Email, headerName: string): string {
    const header = email.payload.headers.find(h =>
      h.name.toLowerCase() === headerName.toLowerCase()
    );
    return header?.value || '';
  }

  /**
   * Escape HTML special characters
   */
  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }

  /**
   * Format date for display
   */
  private formatDateShort(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  }

  /**
   * Save report to file
   */
  saveReport(html: string, filename: string): string {
    // Ensure report directory exists
    if (!fs.existsSync(this.reportDir)) {
      fs.mkdirSync(this.reportDir, { recursive: true });
    }

    const filepath = path.join(this.reportDir, `${filename}.html`);
    fs.writeFileSync(filepath, html, 'utf-8');

    return filepath;
  }

  /**
   * Generate and save report
   */
  generateAndSave(data: ReportData, filename?: string): string {
    const html = this.generateReport(data);
    const reportFilename = filename || `e2e-report-${Date.now()}`;
    return this.saveReport(html, reportFilename);
  }
}
