/**
 * Enhanced HTML Reporter for Multi-Layer E2E Evaluation
 *
 * Generates rich visualizations for:
 * - Layer-by-layer score breakdowns
 * - Critical error highlighting
 * - Performance metrics
 * - Recommendations
 */

import * as fs from 'fs';
import * as path from 'path';
import { TestRunResult } from '../evaluation-v2/test-runner';
import { EvaluationReport } from '../evaluation-v2/multi-layer-evaluator';

export class EnhancedHTMLReporter {

  /**
   * Generate enhanced HTML report from test run result
   */
  generateReport(result: TestRunResult): string {
    const { aggregate, evaluations, metrics, inbox, queries, timestamp } = result;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>E2E Test Report - ${result.runId}</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #1f2937;
      background: #f3f4f6;
    }

    .container { max-width: 1400px; margin: 0 auto; background: white; }

    header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 2rem;
    }

    h1 { font-size: 2rem; margin-bottom: 0.5rem; }
    .subtitle { opacity: 0.9; font-size: 0.9rem; }

    .content { padding: 2rem; }

    /* Dashboard */
    .dashboard {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 1.5rem;
      margin-bottom: 2rem;
    }

    .metric-card {
      background: #f9fafb;
      padding: 1.5rem;
      border-radius: 8px;
      border-left: 4px solid #667eea;
    }

    .metric-card.success { border-left-color: #10b981; }
    .metric-card.warning { border-left-color: #f59e0b; }
    .metric-card.danger { border-left-color: #ef4444; }

    .metric-label {
      font-size: 0.75rem;
      text-transform: uppercase;
      color: #6b7280;
      font-weight: 600;
      margin-bottom: 0.5rem;
    }

    .metric-value {
      font-size: 2rem;
      font-weight: 700;
      color: #1f2937;
    }

    .metric-subtext {
      font-size: 0.875rem;
      color: #6b7280;
      margin-top: 0.25rem;
    }

    /* Charts */
    .chart-section {
      background: white;
      padding: 1.5rem;
      border-radius: 8px;
      margin-bottom: 2rem;
      border: 1px solid #e5e7eb;
    }

    .chart-title {
      font-size: 1.25rem;
      font-weight: 600;
      margin-bottom: 1rem;
      color: #1f2937;
    }

    .chart-container {
      position: relative;
      height: 300px;
    }

    /* Critical Errors */
    .critical-errors {
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 8px;
      padding: 1.5rem;
      margin-bottom: 2rem;
    }

    .critical-errors h3 {
      color: #991b1b;
      margin-bottom: 1rem;
    }

    .error-item {
      background: white;
      padding: 1rem;
      margin-bottom: 0.5rem;
      border-radius: 4px;
      border-left: 3px solid #ef4444;
    }

    /* Evaluation Cards */
    .evaluation {
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
    }

    .evaluation.passed { border-left: 4px solid #10b981; }
    .evaluation.failed { border-left: 4px solid #ef4444; }

    .eval-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
    }

    .eval-query {
      font-size: 1.125rem;
      font-weight: 600;
      color: #1f2937;
    }

    .eval-score {
      font-size: 1.5rem;
      font-weight: 700;
    }

    .score-success { color: #10b981; }
    .score-warning { color: #f59e0b; }
    .score-danger { color: #ef4444; }

    .layer-scores {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 1rem;
      margin: 1rem 0;
    }

    .layer-score {
      text-align: center;
      padding: 0.75rem;
      background: #f9fafb;
      border-radius: 4px;
    }

    .layer-name {
      font-size: 0.75rem;
      text-transform: uppercase;
      color: #6b7280;
      margin-bottom: 0.25rem;
    }

    .layer-value {
      font-size: 1.5rem;
      font-weight: 700;
    }

    .recommendations {
      background: #eff6ff;
      padding: 1rem;
      border-radius: 4px;
      margin-top: 1rem;
    }

    .rec-item {
      margin-bottom: 0.5rem;
      padding-left: 1rem;
      border-left: 2px solid #3b82f6;
    }

    .rec-priority {
      display: inline-block;
      padding: 0.125rem 0.5rem;
      border-radius: 3px;
      font-size: 0.75rem;
      font-weight: 600;
      margin-right: 0.5rem;
    }

    .priority-high { background: #fee2e2; color: #991b1b; }
    .priority-medium { background: #fef3c7; color: #92400e; }
    .priority-low { background: #e0e7ff; color: #3730a3; }

    /* Collapsible */
    .collapsible {
      cursor: pointer;
      user-select: none;
      padding: 0.5rem 0;
    }

    .collapsible:hover { opacity: 0.7; }

    .collapsible::before {
      content: '▼ ';
      display: inline-block;
      margin-right: 0.5rem;
      transition: transform 0.3s;
    }

    .collapsible.collapsed::before {
      transform: rotate(-90deg);
    }

    .collapsible-content {
      max-height: 5000px;
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
      <h1>🧪 E2E Test Report</h1>
      <div class="subtitle">Run ID: ${result.runId} • ${new Date(timestamp).toLocaleString()}</div>
    </header>

    <div class="content">
      <!-- Dashboard -->
      <div class="dashboard">
        <div class="metric-card ${aggregate.summary.passRate.replace('%', '') >= '80' ? 'success' : 'warning'}">
          <div class="metric-label">Pass Rate</div>
          <div class="metric-value">${aggregate.summary.passRate}</div>
          <div class="metric-subtext">${aggregate.summary.passed}/${aggregate.summary.totalTests} tests passed</div>
        </div>

        <div class="metric-card ${aggregate.criticalErrors.count === 0 ? 'success' : 'danger'}">
          <div class="metric-label">Critical Errors</div>
          <div class="metric-value">${aggregate.criticalErrors.count}</div>
          <div class="metric-subtext">${aggregate.criticalErrors.count === 0 ? 'No critical errors' : 'Must fix!'}</div>
        </div>

        <div class="metric-card">
          <div class="metric-label">Overall Score</div>
          <div class="metric-value">${aggregate.avgScores.overall.toFixed(1)}</div>
          <div class="metric-subtext">Average across all tests</div>
        </div>

        <div class="metric-card">
          <div class="metric-label">Weakest Layer</div>
          <div class="metric-value" style="font-size: 1.25rem; text-transform: capitalize;">${aggregate.weakestLayer}</div>
          <div class="metric-subtext">${aggregate.avgScores[aggregate.weakestLayer].toFixed(1)}/100</div>
        </div>

        <div class="metric-card">
          <div class="metric-label">Total Time</div>
          <div class="metric-value">${(metrics.totalTime / 1000).toFixed(1)}<span style="font-size: 1rem;">s</span></div>
          <div class="metric-subtext">${metrics.totalApiCalls} API calls</div>
        </div>

        <div class="metric-card">
          <div class="metric-label">Estimated Cost</div>
          <div class="metric-value">$${metrics.estimatedCost.toFixed(3)}</div>
          <div class="metric-subtext">OpenAI API usage</div>
        </div>
      </div>

      <!-- Layer Scores Chart -->
      <div class="chart-section">
        <h3 class="chart-title">Layer Performance Breakdown</h3>
        <div class="chart-container">
          <canvas id="layerScoresChart"></canvas>
        </div>
      </div>

      <!-- Critical Errors -->
      ${aggregate.criticalErrors.count > 0 ? `
      <div class="critical-errors">
        <h3>🚨 Critical Errors (${aggregate.criticalErrors.count})</h3>
        ${aggregate.criticalErrors.list.slice(0, 10).map((err: string) => `
          <div class="error-item">${this.escapeHtml(err)}</div>
        `).join('')}
        ${aggregate.criticalErrors.list.length > 10 ? `
          <div style="margin-top: 1rem; color: #6b7280;">
            ...and ${aggregate.criticalErrors.list.length - 10} more
          </div>
        ` : ''}
      </div>
      ` : ''}

      <!-- Test Results -->
      <div class="chart-section">
        <h3 class="chart-title collapsible" onclick="toggleCollapse('test-results')">
          Test Results (${evaluations.length})
        </h3>
        <div id="test-results" class="collapsible-content">
          ${evaluations.map((evaluation, i) => this.renderEvaluation(evaluation, i)).join('')}
        </div>
      </div>

      <!-- Performance Metrics -->
      <div class="chart-section">
        <h3 class="chart-title">⏱️ Performance Metrics</h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
          <div>
            <div style="color: #6b7280; font-size: 0.875rem;">Avg Query Time</div>
            <div style="font-size: 1.5rem; font-weight: 600;">${metrics.avgQueryTime.toFixed(0)}ms</div>
          </div>
          <div>
            <div style="color: #6b7280; font-size: 0.875rem;">Avg Evaluation Time</div>
            <div style="font-size: 1.5rem; font-weight: 600;">${metrics.avgEvaluationTime.toFixed(0)}ms</div>
          </div>
          <div>
            <div style="color: #6b7280; font-size: 0.875rem;">Inbox</div>
            <div style="font-size: 1.5rem; font-weight: 600;">${inbox.emailCount} emails</div>
          </div>
          <div>
            <div style="color: #6b7280; font-size: 0.875rem;">Persona</div>
            <div style="font-size: 1.5rem; font-weight: 600; text-transform: capitalize;">${inbox.persona}</div>
          </div>
        </div>

        ${metrics.slowestQueries.length > 0 ? `
          <div style="margin-top: 1.5rem;">
            <h4 style="margin-bottom: 0.5rem;">🐌 Slowest Queries</h4>
            ${metrics.slowestQueries.map(q => `
              <div style="padding: 0.5rem; background: #f9fafb; margin-bottom: 0.25rem; border-radius: 4px;">
                <span style="font-weight: 600;">${q.timeMs}ms</span> - ${this.escapeHtml(q.query.substring(0, 80))}${q.query.length > 80 ? '...' : ''}
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
    </div>
  </div>

  <script>
    // Layer scores chart
    const ctx = document.getElementById('layerScoresChart').getContext('2d');
    new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Query Understanding', 'Retrieval', 'Ranking', 'Presentation', 'Overall'],
        datasets: [{
          label: 'Score',
          data: [
            ${aggregate.avgScores.queryUnderstanding.toFixed(1)},
            ${aggregate.avgScores.retrieval.toFixed(1)},
            ${aggregate.avgScores.ranking.toFixed(1)},
            ${aggregate.avgScores.presentation.toFixed(1)},
            ${aggregate.avgScores.overall.toFixed(1)}
          ],
          backgroundColor: [
            'rgba(102, 126, 234, 0.8)',
            'rgba(118, 75, 162, 0.8)',
            'rgba(237, 100, 166, 0.8)',
            'rgba(16, 185, 129, 0.8)',
            'rgba(59, 130, 246, 0.8)'
          ],
          borderColor: [
            'rgba(102, 126, 234, 1)',
            'rgba(118, 75, 162, 1)',
            'rgba(237, 100, 166, 1)',
            'rgba(16, 185, 129, 1)',
            'rgba(59, 130, 246, 1)'
          ],
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            ticks: {
              callback: function(value) {
                return value + '/100';
              }
            }
          }
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                return 'Score: ' + context.parsed.y + '/100';
              }
            }
          }
        }
      }
    });

    function toggleCollapse(id) {
      const element = document.getElementById(id);
      const trigger = element.previousElementSibling;
      element.classList.toggle('collapsed');
      trigger.classList.toggle('collapsed');
    }
  </script>
</body>
</html>`;
  }

  /**
   * Render individual evaluation
   */
  private renderEvaluation(evaluation: EvaluationReport, index: number): string {
    const scoreClass = evaluation.overallScore >= 80 ? 'score-success' : evaluation.overallScore >= 60 ? 'score-warning' : 'score-danger';
    const statusClass = evaluation.passed ? 'passed' : 'failed';

    return `
    <div class="evaluation ${statusClass}">
      <div class="eval-header">
        <div class="eval-query">${index + 1}. ${this.escapeHtml(evaluation.query)}</div>
        <div class="eval-score ${scoreClass}">${evaluation.overallScore}/100</div>
      </div>

      <div class="layer-scores">
        <div class="layer-score">
          <div class="layer-name">Understanding</div>
          <div class="layer-value">${evaluation.layers.queryUnderstanding.score}</div>
        </div>
        <div class="layer-score">
          <div class="layer-name">Retrieval</div>
          <div class="layer-value">${evaluation.layers.retrieval.score}</div>
        </div>
        <div class="layer-score">
          <div class="layer-name">Ranking</div>
          <div class="layer-value">${evaluation.layers.ranking.score}</div>
        </div>
        <div class="layer-score">
          <div class="layer-name">Presentation</div>
          <div class="layer-value">${evaluation.layers.presentation.score}</div>
        </div>
      </div>

      ${evaluation.diagnosis.criticalErrors.length > 0 ? `
        <div style="background: #fef2f2; padding: 0.75rem; border-radius: 4px; margin: 1rem 0;">
          <strong style="color: #991b1b;">Critical Errors:</strong>
          <ul style="margin-top: 0.5rem; margin-left: 1.5rem; color: #991b1b;">
            ${evaluation.diagnosis.criticalErrors.map(err => `<li>${this.escapeHtml(err)}</li>`).join('')}
          </ul>
        </div>
      ` : ''}

      ${evaluation.recommendations.length > 0 ? `
        <div class="recommendations">
          <strong>💡 Recommendations:</strong>
          ${evaluation.recommendations.map(rec => `
            <div class="rec-item">
              <span class="rec-priority priority-${rec.priority}">${rec.priority.toUpperCase()}</span>
              ${this.escapeHtml(rec.recommendation)}
            </div>
          `).join('')}
        </div>
      ` : ''}
    </div>`;
  }

  /**
   * Escape HTML
   */
  private escapeHtml(text: string | undefined | null): string {
    if (text == null || text === undefined) {
      return '';
    }
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m] || m);
  }

  /**
   * Save report to file
   */
  saveReport(result: TestRunResult, outputDir: string): string {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const html = this.generateReport(result);
    const filename = `${result.runId}.html`;
    const filepath = path.join(outputDir, filename);

    fs.writeFileSync(filepath, html);

    return filepath;
  }
}
