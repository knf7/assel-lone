const ExcelJS = require('exceljs');
const workbook = new ExcelJS.Workbook();
const sheet = workbook.addWorksheet('قروض');
sheet.addRow(['رقم الهوية', 'اسم العميل', 'رقم الجوال', 'المبلغ', 'رقم السند', 'التاريخ']);
sheet.addRow(['1234567890', 'محمد أحمد', '0512345678', '', '', '']); // Only customer
sheet.addRow(['0987654321', 'فاطمة علي', '0598765432', '3000', 'R-002', '2024-01-20']); // Loan
workbook.xlsx.writeFile('frontend_test.xlsx').then(() => console.log('File created'));
