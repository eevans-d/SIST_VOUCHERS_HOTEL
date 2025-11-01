// backend/src/services/reportBuilderService.js

/**
 * Report Builder Service
 * Custom report generation with drag-and-drop interface, 20+ filters, scheduling, and multi-format export
 */

class ReportBuilderService {
  constructor(config = {}) {
    this.config = {
      maxReportSize: config.maxReportSize || 10000,
      defaultFormat: config.defaultFormat || 'pdf',
      storageDir: config.storageDir || './reports',
      schedulerInterval: config.schedulerInterval || 60000,
      ...config
    };

    this.reports = new Map();
    this.templates = new Map();
    this.schedules = new Map();
    this.filters = this.initializeFilters();
    this.schedulerTimer = null;
  }

  // Initialize available filters
  initializeFilters() {
    return {
      dateRange: { type: 'date', label: 'Date Range' },
      roomType: {
        type: 'select',
        label: 'Room Type',
        options: ['single', 'double', 'suite', 'deluxe']
      },
      bookingStatus: {
        type: 'select',
        label: 'Booking Status',
        options: ['confirmed', 'pending', 'cancelled', 'completed']
      },
      paymentStatus: {
        type: 'select',
        label: 'Payment Status',
        options: ['paid', 'unpaid', 'partial', 'refunded']
      },
      customerType: {
        type: 'select',
        label: 'Customer Type',
        options: ['new', 'returning', 'vip', 'corporate']
      },
      bookingSource: {
        type: 'select',
        label: 'Booking Source',
        options: ['direct', 'online', 'agency', 'phone']
      },
      priceRange: { type: 'range', label: 'Price Range', min: 0, max: 10000 },
      occupancyRate: {
        type: 'range',
        label: 'Occupancy Rate',
        min: 0,
        max: 100
      },
      stayDuration: { type: 'number', label: 'Stay Duration (nights)' },
      guestCount: { type: 'number', label: 'Guest Count' },
      city: { type: 'text', label: 'City' },
      country: { type: 'text', label: 'Country' },
      discountCode: { type: 'text', label: 'Discount Code' },
      roomNumber: { type: 'text', label: 'Room Number' },
      floor: { type: 'number', label: 'Floor' },
      amenities: {
        type: 'multiselect',
        label: 'Amenities',
        options: ['wifi', 'parking', 'breakfast', 'pool', 'gym']
      },
      ratingRange: { type: 'range', label: 'Rating Range', min: 1, max: 5 },
      cancellationPolicy: {
        type: 'select',
        label: 'Cancellation Policy',
        options: ['flexible', 'moderate', 'strict']
      },
      checkInTime: { type: 'time', label: 'Check-In Time' },
      checkOutTime: { type: 'time', label: 'Check-Out Time' },
      specialRequests: { type: 'boolean', label: 'Has Special Requests' }
    };
  }

  // Create a new report
  createReport(config) {
    const report = {
      id: this.generateId(),
      name: config.name,
      description: config.description || '',
      template: config.template || 'default',
      sections: config.sections || [],
      filters: config.filters || {},
      columns: config.columns || [],
      sorting: config.sorting || { column: 'date', order: 'desc' },
      grouping: config.grouping || null,
      aggregations: config.aggregations || [],
      format: config.format || this.config.defaultFormat,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: config.userId
    };

    this.reports.set(report.id, report);
    return report;
  }

  // Build and generate report
  async buildReport(reportId, options = {}) {
    const report = this.reports.get(reportId);
    if (!report) {
      throw new Error(`Report ${reportId} not found`);
    }

    // Fetch data based on filters
    const data = await this.fetchData(report.filters, options);

    // Apply sorting
    const sortedData = this.applySorting(data, report.sorting);

    // Apply grouping
    const groupedData = report.grouping
      ? this.applyGrouping(sortedData, report.grouping)
      : sortedData;

    // Calculate aggregations
    const aggregatedData = this.applyAggregations(
      groupedData,
      report.aggregations
    );

    // Select columns
    const columnsData = this.selectColumns(aggregatedData, report.columns);

    // Build sections
    const sections = this.buildSections(columnsData, report.sections);

    // Generate report in specified format
    const output = await this.generateOutput(sections, report.format, report);

    return {
      reportId,
      name: report.name,
      generatedAt: new Date(),
      format: report.format,
      recordCount: data.length,
      output
    };
  }

  // Fetch data with filters
  async fetchData(filters, options = {}) {
    // Simulated data fetching - replace with actual database queries
    let data = this.generateSampleData(options.limit || 1000);

    // Apply each filter
    for (const [filterKey, filterValue] of Object.entries(filters)) {
      data = this.applyFilter(data, filterKey, filterValue);
    }

    return data;
  }

  // Apply single filter to data
  applyFilter(data, filterKey, filterValue) {
    const filter = this.filters[filterKey];
    if (!filter) return data;

    return data.filter((item) => {
      switch (filter.type) {
      case 'date':
        return this.filterByDate(item.date, filterValue);
      case 'select':
        return item[filterKey] === filterValue;
      case 'multiselect':
        return (
          Array.isArray(filterValue) && filterValue.includes(item[filterKey])
        );
      case 'range':
        return (
          item[filterKey] >= filterValue.min &&
            item[filterKey] <= filterValue.max
        );
      case 'number':
        return item[filterKey] === filterValue;
      case 'text':
        return item[filterKey]
          ?.toLowerCase()
          .includes(filterValue.toLowerCase());
      case 'boolean':
        return item[filterKey] === filterValue;
      case 'time':
        return this.filterByTime(item[filterKey], filterValue);
      default:
        return true;
      }
    });
  }

  // Filter by date range
  filterByDate(itemDate, dateFilter) {
    const date = new Date(itemDate);
    const start = dateFilter.start ? new Date(dateFilter.start) : null;
    const end = dateFilter.end ? new Date(dateFilter.end) : null;

    if (start && date < start) return false;
    if (end && date > end) return false;
    return true;
  }

  // Filter by time
  filterByTime(itemTime, timeFilter) {
    if (!timeFilter.start && !timeFilter.end) return true;

    const time = new Date(`1970-01-01T${itemTime}`);
    const start = timeFilter.start
      ? new Date(`1970-01-01T${timeFilter.start}`)
      : null;
    const end = timeFilter.end
      ? new Date(`1970-01-01T${timeFilter.end}`)
      : null;

    if (start && time < start) return false;
    if (end && time > end) return false;
    return true;
  }

  // Apply sorting
  applySorting(data, sorting) {
    if (!sorting || !sorting.column) return data;

    return [...data].sort((a, b) => {
      const aVal = a[sorting.column];
      const bVal = b[sorting.column];

      let comparison = 0;
      if (aVal > bVal) comparison = 1;
      if (aVal < bVal) comparison = -1;

      return sorting.order === 'desc' ? -comparison : comparison;
    });
  }

  // Apply grouping
  applyGrouping(data, groupBy) {
    const grouped = {};

    data.forEach((item) => {
      const key = item[groupBy] || 'Other';
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(item);
    });

    return grouped;
  }

  // Apply aggregations
  applyAggregations(data, aggregations) {
    if (!aggregations || aggregations.length === 0) return data;

    const results = {};

    aggregations.forEach((agg) => {
      const { column, function: func } = agg;
      const values = Array.isArray(data)
        ? data.map((item) => item[column])
        : Object.values(data)
          .flat()
          .map((item) => item[column]);

      switch (func) {
      case 'sum':
        results[`${column}_sum`] = values.reduce(
          (sum, val) => sum + (val || 0),
          0
        );
        break;
      case 'avg':
        results[`${column}_avg`] =
            values.reduce((sum, val) => sum + (val || 0), 0) / values.length;
        break;
      case 'count':
        results[`${column}_count`] = values.length;
        break;
      case 'min':
        results[`${column}_min`] = Math.min(
          ...values.filter((v) => v != null)
        );
        break;
      case 'max':
        results[`${column}_max`] = Math.max(
          ...values.filter((v) => v != null)
        );
        break;
      }
    });

    return { data, aggregations: results };
  }

  // Select specific columns
  selectColumns(data, columns) {
    if (!columns || columns.length === 0) return data;

    const selectFromItem = (item) => {
      const selected = {};
      columns.forEach((col) => {
        selected[col] = item[col];
      });
      return selected;
    };

    if (Array.isArray(data)) {
      return data.map(selectFromItem);
    } else if (data.data) {
      return {
        data: Array.isArray(data.data)
          ? data.data.map(selectFromItem)
          : Object.keys(data.data).reduce((acc, key) => {
            acc[key] = data.data[key].map(selectFromItem);
            return acc;
          }, {}),
        aggregations: data.aggregations
      };
    }

    return data;
  }

  // Build report sections
  buildSections(data, sectionConfigs) {
    return sectionConfigs.map((config) => ({
      title: config.title,
      type: config.type || 'table',
      data: this.formatSectionData(data, config),
      options: config.options || {}
    }));
  }

  // Format data for section
  formatSectionData(data, config) {
    switch (config.type) {
    case 'table':
      return this.formatTableData(data);
    case 'chart':
      return this.formatChartData(data, config.chartType);
    case 'summary':
      return this.formatSummaryData(data);
    case 'text':
      return config.content || '';
    default:
      return data;
    }
  }

  // Format table data
  formatTableData(data) {
    if (Array.isArray(data)) {
      return data;
    } else if (data.data) {
      return Array.isArray(data.data)
        ? data.data
        : Object.values(data.data).flat();
    }
    return [];
  }

  // Format chart data
  formatChartData(data, chartType) {
    const tableData = this.formatTableData(data);
    return {
      labels: tableData.map(
        (item, i) => item.label || item.name || `Item ${i + 1}`
      ),
      datasets: [
        {
          data: tableData.map((item) => item.value || 0),
          backgroundColor: this.generateColors(tableData.length)
        }
      ]
    };
  }

  // Format summary data
  formatSummaryData(data) {
    if (data.aggregations) {
      return data.aggregations;
    }

    const tableData = this.formatTableData(data);
    return {
      totalRecords: tableData.length,
      summary: 'Summary data'
    };
  }

  // Generate output in specified format
  async generateOutput(sections, format, report) {
    switch (format) {
    case 'pdf':
      return this.generatePDF(sections, report);
    case 'excel':
      return this.generateExcel(sections, report);
    case 'csv':
      return this.generateCSV(sections, report);
    case 'json':
      return this.generateJSON(sections, report);
    case 'html':
      return this.generateHTML(sections, report);
    default:
      throw new Error(`Unsupported format: ${format}`);
    }
  }

  // Generate PDF output
  generatePDF(sections, report) {
    // Simulated PDF generation - use library like pdfkit in production
    return {
      type: 'buffer',
      mimeType: 'application/pdf',
      content: Buffer.from(
        `PDF Report: ${report.name}\n${JSON.stringify(sections, null, 2)}`
      ),
      filename: `${report.name.replace(/\s/g, '_')}.pdf`
    };
  }

  // Generate Excel output
  generateExcel(sections, report) {
    // Simulated Excel generation - use library like exceljs in production
    return {
      type: 'buffer',
      mimeType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      content: Buffer.from(
        `Excel Report: ${report.name}\n${JSON.stringify(sections, null, 2)}`
      ),
      filename: `${report.name.replace(/\s/g, '_')}.xlsx`
    };
  }

  // Generate CSV output
  generateCSV(sections, report) {
    const rows = [];
    rows.push(`Report: ${report.name}`);
    rows.push(`Generated: ${new Date().toISOString()}`);
    rows.push('');

    sections.forEach((section) => {
      rows.push(section.title);
      const data = Array.isArray(section.data) ? section.data : [section.data];

      if (data.length > 0) {
        const headers = Object.keys(data[0]);
        rows.push(headers.join(','));

        data.forEach((item) => {
          const values = headers.map((h) => item[h] || '');
          rows.push(values.join(','));
        });
      }

      rows.push('');
    });

    return {
      type: 'text',
      mimeType: 'text/csv',
      content: rows.join('\n'),
      filename: `${report.name.replace(/\s/g, '_')}.csv`
    };
  }

  // Generate JSON output
  generateJSON(sections, report) {
    return {
      type: 'json',
      mimeType: 'application/json',
      content: JSON.stringify(
        {
          report: report.name,
          generatedAt: new Date().toISOString(),
          sections
        },
        null,
        2
      ),
      filename: `${report.name.replace(/\s/g, '_')}.json`
    };
  }

  // Generate HTML output
  generateHTML(sections, report) {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${report.name}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h1 { color: #333; }
            table { border-collapse: collapse; width: 100%; margin: 20px 0; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #4CAF50; color: white; }
          </style>
        </head>
        <body>
          <h1>${report.name}</h1>
          <p>Generated: ${new Date().toISOString()}</p>
          ${sections.map((s) => this.sectionToHTML(s)).join('\n')}
        </body>
      </html>
    `;

    return {
      type: 'text',
      mimeType: 'text/html',
      content: html,
      filename: `${report.name.replace(/\s/g, '_')}.html`
    };
  }

  // Convert section to HTML
  sectionToHTML(section) {
    let html = `<h2>${section.title}</h2>`;

    if (section.type === 'table') {
      const data = Array.isArray(section.data) ? section.data : [section.data];
      if (data.length > 0) {
        const headers = Object.keys(data[0]);
        html += '<table><thead><tr>';
        headers.forEach((h) => {
          html += `<th>${h}</th>`;
        });
        html += '</tr></thead><tbody>';
        data.forEach((item) => {
          html += '<tr>';
          headers.forEach((h) => {
            html += `<td>${item[h] || ''}</td>`;
          });
          html += '</tr>';
        });
        html += '</tbody></table>';
      }
    } else {
      html += `<pre>${JSON.stringify(section.data, null, 2)}</pre>`;
    }

    return html;
  }

  // Schedule report generation
  scheduleReport(reportId, schedule) {
    const scheduleConfig = {
      id: this.generateId(),
      reportId,
      frequency: schedule.frequency, // 'daily', 'weekly', 'monthly'
      time: schedule.time,
      recipients: schedule.recipients || [],
      format: schedule.format || 'pdf',
      enabled: schedule.enabled !== false,
      createdAt: new Date()
    };

    this.schedules.set(scheduleConfig.id, scheduleConfig);
    this.startScheduler();

    return scheduleConfig;
  }

  // Start scheduler
  startScheduler() {
    if (this.schedulerTimer) return;

    this.schedulerTimer = setInterval(() => {
      this.checkSchedules();
    }, this.config.schedulerInterval);
  }

  // Check and execute scheduled reports
  async checkSchedules() {
    const now = new Date();

    for (const [scheduleId, schedule] of this.schedules) {
      if (!schedule.enabled) continue;

      if (this.shouldExecuteSchedule(schedule, now)) {
        try {
          const result = await this.buildReport(schedule.reportId);
          await this.sendReport(result, schedule.recipients, schedule.format);
          schedule.lastExecuted = now;
        } catch (error) {
          console.error(
            `Failed to execute scheduled report ${scheduleId}:`,
            error
          );
        }
      }
    }
  }

  // Check if schedule should execute
  shouldExecuteSchedule(schedule, now) {
    if (!schedule.lastExecuted) return true;

    const lastExec = new Date(schedule.lastExecuted);
    const hoursSince = (now - lastExec) / (1000 * 60 * 60);

    switch (schedule.frequency) {
    case 'daily':
      return hoursSince >= 24;
    case 'weekly':
      return hoursSince >= 168;
    case 'monthly':
      return hoursSince >= 720;
    default:
      return false;
    }
  }

  // Send report to recipients
  async sendReport(report, recipients, format) {
    // Simulated email sending - integrate with email service
    console.log(
      `Sending report to ${recipients.join(', ')} in ${format} format`
    );
    return true;
  }

  // Create report template
  createTemplate(template) {
    const tmpl = {
      id: this.generateId(),
      name: template.name,
      description: template.description || '',
      sections: template.sections || [],
      filters: template.filters || {},
      columns: template.columns || [],
      createdAt: new Date()
    };

    this.templates.set(tmpl.id, tmpl);
    return tmpl;
  }

  // Get report template
  getTemplate(templateId) {
    return this.templates.get(templateId);
  }

  // List all templates
  listTemplates() {
    return Array.from(this.templates.values());
  }

  // Generate sample data
  generateSampleData(count) {
    const data = [];
    const roomTypes = ['single', 'double', 'suite', 'deluxe'];
    const statuses = ['confirmed', 'pending', 'cancelled', 'completed'];

    for (let i = 0; i < count; i++) {
      data.push({
        id: i + 1,
        date: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000),
        roomType: roomTypes[Math.floor(Math.random() * roomTypes.length)],
        bookingStatus: statuses[Math.floor(Math.random() * statuses.length)],
        paymentStatus: 'paid',
        price: 50 + Math.random() * 450,
        occupancyRate: Math.random() * 100,
        stayDuration: 1 + Math.floor(Math.random() * 14),
        guestCount: 1 + Math.floor(Math.random() * 4),
        rating: 1 + Math.random() * 4
      });
    }

    return data;
  }

  // Generate colors for charts
  generateColors(count) {
    const colors = [];
    for (let i = 0; i < count; i++) {
      colors.push(`hsl(${(i * 360) / count}, 70%, 60%)`);
    }
    return colors;
  }

  // Generate unique ID
  generateId() {
    return `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Get available filters
  getAvailableFilters() {
    return this.filters;
  }

  // Get report by ID
  getReport(reportId) {
    return this.reports.get(reportId);
  }

  // List all reports
  listReports(filters = {}) {
    let reports = Array.from(this.reports.values());

    if (filters.userId) {
      reports = reports.filter((r) => r.createdBy === filters.userId);
    }

    return reports;
  }

  // Delete report
  deleteReport(reportId) {
    return this.reports.delete(reportId);
  }

  // Get statistics
  getStatistics() {
    return {
      totalReports: this.reports.size,
      totalTemplates: this.templates.size,
      activeSchedules: Array.from(this.schedules.values()).filter(
        (s) => s.enabled
      ).length,
      availableFilters: Object.keys(this.filters).length
    };
  }
}

export default ReportBuilderService;
