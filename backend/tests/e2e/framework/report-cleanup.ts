/**
 * Report Cleanup Utility
 * Automatically cleans up old E2E test reports to keep only the most recent ones
 */

import fs from 'fs';
import path from 'path';
import logger from '../../../src/utils/logger';

interface ReportFile {
  filepath: string;
  mtime: Date;
  size: number;
}

export class ReportCleanup {
  private static readonly MAX_REPORTS_PER_TYPE = 5; // Keep only last 5 reports per test type
  private static readonly MAX_TOTAL_REPORTS = 50; // Keep only last 50 reports total
  private static readonly REPORTS_DIR = path.join(__dirname, '../reports/detailed-executions');
  private static readonly ARCHIVE_DIR = path.join(__dirname, '../reports/archive');

  /**
   * Clean up old reports, keeping only the most recent ones
   */
  static async cleanupReports(): Promise<void> {
    try {
      logger.info('Starting E2E report cleanup', {
        operation: 'report_cleanup_start',
        reportsDir: this.REPORTS_DIR
      });

      if (!fs.existsSync(this.REPORTS_DIR)) {
        logger.info('Reports directory does not exist, skipping cleanup', {
          operation: 'report_cleanup_skip',
          reportsDir: this.REPORTS_DIR
        });
        return;
      }

      const reportFiles = await this.getReportFiles();
      
      if (reportFiles.length === 0) {
        logger.info('No report files found, skipping cleanup', {
          operation: 'report_cleanup_skip'
        });
        return;
      }

      // Group reports by test type
      const reportsByType = this.groupReportsByType(reportFiles);
      
      // Clean up by test type (keep only recent ones)
      let totalDeleted = 0;
      for (const [testType, reports] of reportsByType.entries()) {
        if (reports.length > this.MAX_REPORTS_PER_TYPE) {
          const toDelete = reports.slice(0, reports.length - this.MAX_REPORTS_PER_TYPE);
          totalDeleted += await this.deleteReports(toDelete, testType);
        }
      }

      // If still too many reports, delete oldest ones overall
      const remainingReports = await this.getReportFiles();
      if (remainingReports.length > this.MAX_TOTAL_REPORTS) {
        const sortedReports = remainingReports.sort((a, b) => a.mtime.getTime() - b.mtime.getTime());
        const toDelete = sortedReports.slice(0, remainingReports.length - this.MAX_TOTAL_REPORTS);
        totalDeleted += await this.deleteReports(toDelete, 'overall');
      }

      logger.info('E2E report cleanup completed', {
        operation: 'report_cleanup_complete',
        totalDeleted,
        remainingReports: (await this.getReportFiles()).length
      });

    } catch (error) {
      logger.error('Failed to cleanup E2E reports', error as Error, {
        operation: 'report_cleanup_error'
      });
    }
  }

  /**
   * Get all report files with their metadata
   */
  private static async getReportFiles(): Promise<ReportFile[]> {
    const files = fs.readdirSync(this.REPORTS_DIR);
    const reportFiles: ReportFile[] = [];

    for (const file of files) {
      if (file.endsWith('.md')) {
        const filepath = path.join(this.REPORTS_DIR, file);
        const stats = fs.statSync(filepath);
        
        reportFiles.push({
          filepath,
          mtime: stats.mtime,
          size: stats.size
        });
      }
    }

    return reportFiles;
  }

  /**
   * Group reports by test type based on filename patterns
   */
  private static groupReportsByType(reports: ReportFile[]): Map<string, ReportFile[]> {
    const grouped = new Map<string, ReportFile[]>();

    for (const report of reports) {
      const filename = path.basename(report.filepath);
      const testType = this.extractTestType(filename);
      
      if (!grouped.has(testType)) {
        grouped.set(testType, []);
      }
      
      grouped.get(testType)!.push(report);
    }

    // Sort each group by modification time (oldest first)
    for (const reports of grouped.values()) {
      reports.sort((a, b) => a.mtime.getTime() - b.mtime.getTime());
    }

    return grouped;
  }

  /**
   * Extract test type from filename
   */
  private static extractTestType(filename: string): string {
    // Extract test type from patterns like:
    // test_simple_email_test_simple_email_2025-09-29T21-14-39-865Z.md
    // test_calendar_scheduling_test_calendar_scheduling_2025-09-29T20-29-58-949Z.md
    
    const match = filename.match(/^test_([^_]+)_/);
    if (match && match[1]) {
      return match[1];
    }

    // Fallback for other patterns
    if (filename.startsWith('trace-')) {
      return 'trace';
    }

    return 'unknown';
  }

  /**
   * Delete a list of report files
   */
  private static async deleteReports(reports: ReportFile[], testType: string): Promise<number> {
    let deleted = 0;

    for (const report of reports) {
      try {
        fs.unlinkSync(report.filepath);
        deleted++;
        
        logger.debug('Deleted old E2E report', {
          operation: 'report_deleted',
          testType,
          filepath: report.filepath,
          mtime: report.mtime.toISOString(),
          size: report.size
        });
      } catch (error) {
        logger.warn('Failed to delete E2E report', {
          operation: 'report_delete_failed',
          testType,
          filepath: report.filepath,
          error: (error as Error).message
        });
      }
    }

    if (deleted > 0) {
      logger.info('Deleted old E2E reports', {
        operation: 'reports_deleted',
        testType,
        count: deleted
      });
    }

    return deleted;
  }

  /**
   * Get cleanup statistics
   */
  static async getCleanupStats(): Promise<{
    totalReports: number;
    reportsByType: Record<string, number>;
    totalSize: number;
  }> {
    const reportFiles = await this.getReportFiles();
    const reportsByType = this.groupReportsByType(reportFiles);

    const stats = {
      totalReports: reportFiles.length,
      reportsByType: {} as Record<string, number>,
      totalSize: 0
    };

    for (const [testType, reports] of reportsByType.entries()) {
      stats.reportsByType[testType] = reports.length;
      stats.totalSize += reports.reduce((sum, report) => sum + report.size, 0);
    }

    return stats;
  }

  /**
   * Archive all current reports before starting a new test run
   * Moves all reports to a timestamped archive folder
   */
  static async archiveAllReports(): Promise<void> {
    try {
      logger.info('Archiving all E2E reports before test run', {
        operation: 'report_archive_start',
        reportsDir: this.REPORTS_DIR
      });

      if (!fs.existsSync(this.REPORTS_DIR)) {
        logger.info('Reports directory does not exist, skipping archive', {
          operation: 'report_archive_skip'
        });
        return;
      }

      const reportFiles = await this.getReportFiles();

      if (reportFiles.length === 0) {
        logger.info('No reports to archive', {
          operation: 'report_archive_skip'
        });
        return;
      }

      // Create timestamped archive directory
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const archiveSubDir = path.join(this.ARCHIVE_DIR, timestamp);

      if (!fs.existsSync(archiveSubDir)) {
        fs.mkdirSync(archiveSubDir, { recursive: true });
      }

      // Move all reports to archive
      let archivedCount = 0;
      for (const report of reportFiles) {
        try {
          const filename = path.basename(report.filepath);
          const archivePath = path.join(archiveSubDir, filename);

          fs.renameSync(report.filepath, archivePath);
          archivedCount++;
        } catch (error) {
          logger.warn('Failed to archive report', {
            operation: 'report_archive_failed',
            filepath: report.filepath,
            error: (error as Error).message
          });
        }
      }

      logger.info('E2E reports archived successfully', {
        operation: 'report_archive_complete',
        archivedCount,
        archiveDir: archiveSubDir
      });

    } catch (error) {
      logger.error('Failed to archive E2E reports', error as Error, {
        operation: 'report_archive_error'
      });
    }
  }

  /**
   * Clear all reports (without archiving)
   * Use this if you don't want to keep historical data
   */
  static async clearAllReports(): Promise<void> {
    try {
      logger.info('Clearing all E2E reports before test run', {
        operation: 'report_clear_start',
        reportsDir: this.REPORTS_DIR
      });

      if (!fs.existsSync(this.REPORTS_DIR)) {
        logger.info('Reports directory does not exist, skipping clear', {
          operation: 'report_clear_skip'
        });
        return;
      }

      const reportFiles = await this.getReportFiles();

      if (reportFiles.length === 0) {
        logger.info('No reports to clear', {
          operation: 'report_clear_skip'
        });
        return;
      }

      // Delete all reports
      let clearedCount = 0;
      for (const report of reportFiles) {
        try {
          fs.unlinkSync(report.filepath);
          clearedCount++;
        } catch (error) {
          logger.warn('Failed to delete report', {
            operation: 'report_delete_failed',
            filepath: report.filepath,
            error: (error as Error).message
          });
        }
      }

      logger.info('E2E reports cleared successfully', {
        operation: 'report_clear_complete',
        clearedCount
      });

    } catch (error) {
      logger.error('Failed to clear E2E reports', error as Error, {
        operation: 'report_clear_error'
      });
    }
  }
}
