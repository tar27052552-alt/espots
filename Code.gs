function doGet() {
  let htmlTemplate;
  try {
    // Try uppercase 'Index'
    htmlTemplate = HtmlService.createTemplateFromFile('Index');
  } catch (e) {
    try {
      // Try lowercase 'index' as fallback
      htmlTemplate = HtmlService.createTemplateFromFile('index');
    } catch (err) {
      // Return a friendly error message page if both are missing
      return HtmlService.createHtmlOutput(
        "<div style='font-family: sans-serif; padding: 30px; text-align: center; color: #ff4655;'>" +
        "<h2>❌ ไม่พบไฟล์ HTML ชื่อ 'Index'</h2>" +
        "<p style='color: #666; max-width: 500px; margin: 0 auto 20px;'>กรุณาสร้างไฟล์ HTML เพิ่มใน Apps Script โดยกดเครื่องหมายบวก <b>(+)</b> ที่เมนูด้านซ้าย เลือก <b>HTML</b> และตั้งชื่อไฟล์ว่า <b>Index</b> (ตัว I พิมพ์ใหญ่)</p>" +
        "<p style='color: #999; font-size: 13px;'>อย่าลืมกดบันทึกโครงการ (รูปแผ่นดิสก์ 💾 หรือกด Ctrl+S) ก่อนเปิดใช้งานใหม่</p>" +
        "</div>"
      );
    }
  }
  
  return htmlTemplate.evaluate()
    .setTitle('Free Fire Tournament Registration Dashboard')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Fetches and parses registration data from the spreadsheet.
 */
function getRegistrationData() {
  try {
    const sheetId = '1iQxENTiRmwQm_XLRY75Bnz6FZmLxKtdPuUOJxMjj88w';
    let ss;
    try {
      ss = SpreadsheetApp.openById(sheetId);
    } catch(e) {
      ss = SpreadsheetApp.getActiveSpreadsheet();
    }
    
    const sheets = ss.getSheets();
    // Try to find sheet by GID (2063826674) or use the first sheet
    const sheet = sheets.find(s => s.getSheetId() === 2063826674) || sheets[0];
    const data = sheet.getDataRange().getValues();
    if (data.length < 2) return [];
    
    const rows = data.slice(1);
    
    const structured = rows.map((row, index) => {
      // Validate that we have at least a team name
      if (row.length < 2 || !row[1] || String(row[1]).trim() === '') return null;
      
      const timestamp = row[0] ? formatValue(row[0]) : '';
      const teamName = String(row[1]).trim();
      
      const members = [];
      // Up to 4 members, each occupies 6 columns
      for (let m = 0; m < 4; m++) {
        const base = 2 + m * 6;
        if (base + 4 < row.length) {
          const studentId = row[base] ? String(row[base]).trim() : '';
          const title = row[base + 1] ? String(row[base + 1]).trim() : '';
          const name = row[base + 2] ? String(row[base + 2]).trim() : '';
          const level = row[base + 3] ? String(row[base + 3]).trim() : '';
          const room = row[base + 4] ? String(row[base + 4]).trim() : '';
          const phone = row[base + 5] ? String(row[base + 5]).trim() : '';
          
          // Member is valid if they have a student ID or name
          if (studentId || name) {
            members.push({
              studentId,
              title,
              name,
              level,
              room,
              phone
            });
          }
        }
      }
      
      return {
        id: index + 1,
        timestamp,
        teamName,
        members
      };
    }).filter(t => t !== null);
    
    return structured;
  } catch (error) {
    throw new Error('Failed to fetch data: ' + error.toString());
  }
}

/**
 * Formats values correctly, especially date objects.
 */
function formatValue(val) {
  if (val instanceof Date) {
    try {
      return Utilities.formatDate(val, Session.getScriptTimeZone(), 'd/M/yyyy, HH:mm:ss');
    } catch (e) {
      // Fallback if timezone issue
      return Utilities.formatDate(val, "GMT+7", 'd/M/yyyy, HH:mm:ss');
    }
  }
  return String(val);
}
