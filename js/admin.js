// DOM Elements
const adminEmailEl = document.getElementById('adminEmail');
const logoutBtn = document.getElementById('logoutBtn');
const salesForm = document.getElementById('salesForm');
const customerSelect = document.getElementById('customerSelect');
const yearSelect = document.getElementById('yearSelect');
const monthSelect = document.getElementById('monthSelect');
const categoryInput = document.getElementById('category');
const categoryList = document.getElementById('categoryList');
const amountInput = document.getElementById('amount');
const salesCountInput = document.getElementById('salesCount');
const noteInput = document.getElementById('note');
const messageEl = document.getElementById('message');

// Bulk Upload Elements
const bulkCustomerSelect = document.getElementById('bulkCustomerSelect');
const pasteArea = document.getElementById('pasteArea');
const previewSection = document.getElementById('previewSection');
const previewTable = document.getElementById('previewTable');
const previewCount = document.getElementById('previewCount');
const bulkUploadBtn = document.getElementById('bulkUploadBtn');
const clearBulkBtn = document.getElementById('clearBulkBtn');
const clearPreviewBtn = document.getElementById('clearPreview');
const bulkMessageEl = document.getElementById('bulkMessage');
const uploadProgress = document.getElementById('uploadProgress');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');

// File Upload Elements
const fileCustomerSelect = document.getElementById('fileCustomerSelect');
const fileUpload = document.getElementById('fileUpload');
const fileSelectBtn = document.getElementById('fileSelectBtn');
const fileName = document.getElementById('fileName');
const filePreviewSection = document.getElementById('filePreviewSection');
const filePreviewTable = document.getElementById('filePreviewTable');
const filePreviewCount = document.getElementById('filePreviewCount');
const fileUploadBtn = document.getElementById('fileUploadBtn');
const clearFileBtn = document.getElementById('clearFileBtn');
const clearFilePreview = document.getElementById('clearFilePreview');
const fileMessage = document.getElementById('fileMessage');
const fileUploadProgress = document.getElementById('fileUploadProgress');
const fileProgressFill = document.getElementById('fileProgressFill');
const fileProgressText = document.getElementById('fileProgressText');

// Tab Elements
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

// 관리자 이메일 목록 (여기에 관리자 이메일 추가)
const ADMIN_EMAILS = ['anteater1@naver.com', 'mlbooks001@gmail.com'];

// 현재 사용자
let currentUser = null;
let parsedData = []; // 파싱된 데이터 저장
let fileParsedData = []; // 파일에서 파싱된 데이터 저장

// 페이지 로드 시 인증 확인
document.addEventListener('DOMContentLoaded', async () => {
    await checkAdminAuth();
    await loadCustomers(); // 고객 선택 드롭다운용으로만 사용
    await loadCategories();
    setCurrentMonth();
});

// 관리자 인증 확인
async function checkAdminAuth() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    
    if (!session) {
        window.location.href = 'index.html';
        return;
    }
    
    currentUser = session.user;
    
    // 관리자 권한 확인
    if (!ADMIN_EMAILS.includes(currentUser.email)) {
        alert('관리자 권한이 없습니다.');
        window.location.href = 'dashboard.html';
        return;
    }
    
    adminEmailEl.textContent = currentUser.email;
}

// 로그아웃
logoutBtn.addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    window.location.href = 'index.html';
});

// 현재 월 설정
function setCurrentMonth() {
    const currentMonth = new Date().getMonth() + 1;
    monthSelect.value = currentMonth;
}

// 고객 목록 로드 (고객 선택 드롭다운용)
async function loadCustomers() {
    try {
        // auth.users에서 모든 사용자 가져오기 (관리자 제외)
        const { data: { users }, error } = await supabaseClient.auth.admin.listUsers();
        
        if (error) {
            // admin API 접근 불가시 대체 방법
            await loadCustomersFromProfiles();
            return;
        }
        
        const customers = users.filter(user => !ADMIN_EMAILS.includes(user.email));
        populateCustomerSelect(customers);
        
    } catch (error) {
        console.error('Error loading customers:', error);
        await loadCustomersFromProfiles();
    }
}

// profiles 테이블에서 고객 로드 (대체 방법)
async function loadCustomersFromProfiles() {
    try {
        const { data: profiles, error } = await supabaseClient
            .from('profiles')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error && error.code === '42P01') {
            // 테이블이 없는 경우
            populateCustomerSelect([]);
            return;
        }
        
        if (profiles && profiles.length > 0) {
            populateCustomerSelect(profiles);
        } else {
            // profiles 테이블은 있지만 데이터가 없는 경우 - auth users 직접 조회
            await loadCustomersDirectly();
        }
    } catch (error) {
        console.error('Error loading profiles:', error);
        await loadCustomersDirectly();
    }
}

// 직접 사용자 조회 (Supabase에서 가입한 사용자)
async function loadCustomersDirectly() {
    try {
        // sales_reports 테이블에서 user_id 목록 가져오기
        const { data: salesData, error } = await supabaseClient
            .from('sales_reports')
            .select('user_id')
            .limit(100);
        
        if (error && error.code === '42P01') {
            populateCustomerSelect([]);
            return;
        }
        
        if (salesData && salesData.length > 0) {
            const uniqueUserIds = [...new Set(salesData.map(s => s.user_id))];
            const customers = uniqueUserIds.map(id => ({ id, email: `User ${id.slice(0, 8)}...` }));
            populateCustomerSelect(customers);
        } else {
            populateCustomerSelect([]);
        }
    } catch (error) {
        console.error('Error:', error);
        populateCustomerSelect([]);
    }
}


// 고객 선택 옵션 채우기
function populateCustomerSelect(customers) {
    if (!customers || customers.length === 0) {
        if (customerSelect) customerSelect.innerHTML = '<option value="">등록된 고객이 없습니다</option>';
        if (bulkCustomerSelect) bulkCustomerSelect.innerHTML = '<option value="">등록된 고객이 없습니다</option>';
        if (fileCustomerSelect) fileCustomerSelect.innerHTML = '<option value="">등록된 고객이 없습니다</option>';
        return;
    }
    
    // 모든 고객 선택 드롭다운 초기화
    if (customerSelect) customerSelect.innerHTML = '<option value="">고객을 선택하세요</option>';
    if (bulkCustomerSelect) bulkCustomerSelect.innerHTML = '<option value="">고객을 선택하세요</option>';
    if (fileCustomerSelect) fileCustomerSelect.innerHTML = '<option value="">고객을 선택하세요</option>';
    
    customers.forEach(customer => {
        const customerName = customer.user_metadata?.company_name || customer.company_name || '회사명 없음';
        const displayText = `${customerName} (${customer.email})`;
        
        // 개별 등록 탭
        if (customerSelect) {
            const option1 = document.createElement('option');
            option1.value = customer.id;
            option1.textContent = displayText;
            customerSelect.appendChild(option1);
        }
        
        // 일괄 등록 탭
        if (bulkCustomerSelect) {
            const option2 = document.createElement('option');
            option2.value = customer.id;
            option2.textContent = displayText;
            bulkCustomerSelect.appendChild(option2);
        }
        
        // 파일 업로드 탭
        if (fileCustomerSelect) {
            const option3 = document.createElement('option');
            option3.value = customer.id;
            option3.textContent = displayText;
            fileCustomerSelect.appendChild(option3);
        }
    });
}

// 매출 데이터 등록
salesForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const userId = customerSelect.value;
    const year = parseInt(yearSelect.value);
    const month = parseInt(monthSelect.value);
    const category = categoryInput.value.trim();
    const amount = parseFloat(amountInput.value);
    const salesCount = salesCountInput.value ? parseInt(salesCountInput.value) : null;
    const note = noteInput.value.trim() || null;
    
    if (!userId) {
        showMessage('고객을 선택해주세요.', 'error');
        return;
    }
    
    if (!category) {
        showMessage('매출 종류를 입력해주세요.', 'error');
        return;
    }
    
    const submitBtn = salesForm.querySelector('.submit-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = '등록 중...';
    
    try {
        // 기존 데이터 확인 (같은 사용자, 연도, 월, 카테고리)
        const { data: existing } = await supabaseClient
            .from('sales_reports')
            .select('id')
            .eq('user_id', userId)
            .eq('year', year)
            .eq('month', month)
            .eq('category', category)
            .single();
        
        if (existing) {
            // 업데이트
            const { error } = await supabaseClient
                .from('sales_reports')
                .update({
                    amount,
                    sales_count: salesCount,
                    note,
                    updated_at: new Date().toISOString()
                })
                .eq('id', existing.id);
            
            if (error) throw error;
            showMessage('매출 데이터가 업데이트되었습니다.', 'success');
        } else {
            // 새로 등록
            const { error } = await supabaseClient
                .from('sales_reports')
                .insert({
                    user_id: userId,
                    year,
                    month,
                    category,
                    amount,
                    sales_count: salesCount,
                    note
                });
            
            if (error) throw error;
            showMessage('매출 데이터가 등록되었습니다.', 'success');
        }
        
        // 폼 초기화
        salesForm.reset();
        setCurrentMonth();
        await loadCategories();
        
    } catch (error) {
        console.error('Error saving sales:', error);
        showMessage('저장 중 오류가 발생했습니다: ' + error.message, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = '매출 등록';
    }
});

// 카테고리 목록 로드 (자동완성용)
async function loadCategories() {
    try {
        const { data, error } = await supabaseClient
            .from('sales_reports')
            .select('category')
            .not('category', 'is', null);
        
        if (error) throw error;
        
        // 중복 제거
        const uniqueCategories = [...new Set(data.map(d => d.category).filter(c => c))];
        
        // datalist 업데이트
        categoryList.innerHTML = uniqueCategories
            .map(cat => `<option value="${cat}">`)
            .join('');
            
    } catch (error) {
        console.error('Error loading categories:', error);
    }
}


// 메시지 표시
function showMessage(text, type) {
    messageEl.textContent = text;
    messageEl.className = `message ${type}`;
    
    setTimeout(() => {
        messageEl.className = 'message';
    }, 5000);
}

// 통화 포맷
function formatCurrency(amount) {
    return '₩' + Math.round(amount).toLocaleString('ko-KR');
}

// 날짜 포맷
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR');
}


// ==========================================
// 탭 메뉴 기능
// ==========================================
tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const tabId = btn.dataset.tab;
        
        // 모든 탭 버튼 비활성화
        tabBtns.forEach(b => b.classList.remove('active'));
        // 모든 탭 콘텐츠 숨기기
        tabContents.forEach(c => c.classList.remove('active'));
        
        // 선택한 탭 활성화
        btn.classList.add('active');
        document.getElementById(tabId + 'Tab').classList.add('active');
    });
});

// ==========================================
// 일괄 등록 (복사/붙여넣기) 기능
// ==========================================

// 붙여넣기 영역 이벤트
pasteArea.addEventListener('input', handlePasteData);
pasteArea.addEventListener('paste', (e) => {
    // 약간의 딜레이 후 처리 (붙여넣기 완료 대기)
    setTimeout(handlePasteData, 100);
});

// 데이터 파싱 및 미리보기
function handlePasteData() {
    const rawData = pasteArea.value.trim();
    
    if (!rawData) {
        previewSection.style.display = 'none';
        bulkUploadBtn.disabled = true;
        parsedData = [];
        return;
    }
    
    // 데이터 파싱
    parsedData = parseSpreadsheetData(rawData);
    
    if (parsedData.length > 0) {
        displayPreview(parsedData);
        previewSection.style.display = 'block';
        bulkUploadBtn.disabled = false;
    } else {
        previewSection.style.display = 'none';
        bulkUploadBtn.disabled = true;
        showBulkMessage('데이터 형식이 올바르지 않습니다. 형식을 확인해주세요.', 'error');
    }
}

// 스프레드시트 데이터 파싱
function parseSpreadsheetData(rawData) {
    const lines = rawData.split('\n').filter(line => line.trim());
    const result = [];
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        // 탭 또는 여러 공백으로 분리
        const columns = line.split(/\t+/);
        
        // 최소 3개 컬럼 필요
        if (columns.length < 3) {
            result.push({
                row: i + 1,
                error: true,
                errorMessage: '컬럼 수 부족 (최소 3개 필요)',
                raw: line
            });
            continue;
        }
        
        let year, month, category, amount, salesCount = null, note = null;
        
        // 첫 번째 컬럼 확인: YYYYMMDD 형식인지, YYYY 형식인지
        const firstCol = columns[0].trim();
        
        if (firstCol.length === 8 && /^\d{8}$/.test(firstCol)) {
            // YYYYMMDD 형식 (예: 20251231)
            year = parseInt(firstCol.substring(0, 4));
            month = parseInt(firstCol.substring(4, 6));
            // 형식: YYYYMMDD, 매출액, 매출종류, [판매건수], [비고]
            amount = parseNumber(columns[1]);
            category = columns[2]?.trim();
            salesCount = columns[3] ? parseInt(parseNumber(columns[3])) : null;
            note = columns[4]?.trim() || null;
        } else if (firstCol.length === 6 && /^\d{6}$/.test(firstCol)) {
            // YYYYMM 형식 (예: 202512)
            year = parseInt(firstCol.substring(0, 4));
            month = parseInt(firstCol.substring(4, 6));
            // 형식: YYYYMM, 매출액, 매출종류, [판매건수], [비고]
            amount = parseNumber(columns[1]);
            category = columns[2]?.trim();
            salesCount = columns[3] ? parseInt(parseNumber(columns[3])) : null;
            note = columns[4]?.trim() || null;
        } else {
            // 기본 형식: 연도, 월, 매출종류, 매출액, [판매건수], [비고]
            year = parseInt(columns[0]);
            month = parseInt(columns[1]);
            category = columns[2]?.trim();
            amount = parseNumber(columns[3]);
            salesCount = columns[4] ? parseInt(parseNumber(columns[4])) : null;
            note = columns[5]?.trim() || null;
        }
        
        // 유효성 검사
        if (isNaN(year) || year < 2000 || year > 2100) {
            result.push({
                row: i + 1,
                error: true,
                errorMessage: '연도 형식 오류',
                raw: line
            });
            continue;
        }
        
        if (isNaN(month) || month < 1 || month > 12) {
            result.push({
                row: i + 1,
                error: true,
                errorMessage: '월 형식 오류 (1-12)',
                raw: line
            });
            continue;
        }
        
        if (!category) {
            result.push({
                row: i + 1,
                error: true,
                errorMessage: '매출종류 누락',
                raw: line
            });
            continue;
        }
        
        if (isNaN(amount) || amount < 0) {
            result.push({
                row: i + 1,
                error: true,
                errorMessage: '매출액 형식 오류',
                raw: line
            });
            continue;
        }
        
        result.push({
            row: i + 1,
            error: false,
            year,
            month,
            category,
            amount,
            salesCount: isNaN(salesCount) ? null : salesCount,
            note
        });
    }
    
    return result;
}

// 숫자 파싱 (쉼표, 공백 제거)
function parseNumber(str) {
    if (!str) return NaN;
    // 쉼표, 공백, 원화 기호 등 제거
    const cleaned = str.toString().replace(/[,\s₩원]/g, '');
    return parseFloat(cleaned);
}

// 미리보기 표시
function displayPreview(data) {
    const validData = data.filter(d => !d.error);
    const errorData = data.filter(d => d.error);
    
    previewCount.textContent = validData.length;
    
    let html = `
        <table class="preview-table">
            <thead>
                <tr>
                    <th>행</th>
                    <th>연도</th>
                    <th>월</th>
                    <th>매출종류</th>
                    <th>매출액</th>
                    <th>판매건수</th>
                    <th>비고</th>
                    <th>상태</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    data.forEach(item => {
        if (item.error) {
            html += `
                <tr class="error-row">
                    <td>${item.row}</td>
                    <td colspan="6">${item.raw}</td>
                    <td>❌ ${item.errorMessage}</td>
                </tr>
            `;
        } else {
            html += `
                <tr>
                    <td>${item.row}</td>
                    <td>${item.year}년</td>
                    <td>${item.month}월</td>
                    <td>${item.category}</td>
                    <td class="amount">${formatCurrency(item.amount)}</td>
                    <td>${item.salesCount || '-'}</td>
                    <td>${item.note || '-'}</td>
                    <td>✅</td>
                </tr>
            `;
        }
    });
    
    html += '</tbody></table>';
    
    if (errorData.length > 0) {
        html += `<p style="color: #dc2626; padding: 12px 16px; font-size: 14px;">⚠️ ${errorData.length}개 행에 오류가 있습니다. 오류 행은 제외하고 업로드됩니다.</p>`;
    }
    
    previewTable.innerHTML = html;
}

// 일괄 등록 버튼 클릭
bulkUploadBtn.addEventListener('click', async () => {
    const userId = bulkCustomerSelect.value;
    
    if (!userId) {
        showBulkMessage('고객을 선택해주세요.', 'error');
        return;
    }
    
    const validData = parsedData.filter(d => !d.error);
    
    if (validData.length === 0) {
        showBulkMessage('업로드할 유효한 데이터가 없습니다.', 'error');
        return;
    }
    
    // 확인 메시지
    if (!confirm(`${validData.length}건의 매출 데이터를 등록하시겠습니까?`)) {
        return;
    }
    
    bulkUploadBtn.disabled = true;
    uploadProgress.style.display = 'block';
    
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < validData.length; i++) {
        const item = validData[i];
        
        try {
            // 기존 데이터 확인 (카테고리 포함)
            const { data: existing } = await supabaseClient
                .from('sales_reports')
                .select('id')
                .eq('user_id', userId)
                .eq('year', item.year)
                .eq('month', item.month)
                .eq('category', item.category)
                .single();
            
            if (existing) {
                // 업데이트
                const { error } = await supabaseClient
                    .from('sales_reports')
                    .update({
                        amount: item.amount,
                        sales_count: item.salesCount,
                        note: item.note,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', existing.id);
                
                if (error) throw error;
            } else {
                // 새로 등록
                const { error } = await supabaseClient
                    .from('sales_reports')
                    .insert({
                        user_id: userId,
                        year: item.year,
                        month: item.month,
                        category: item.category,
                        amount: item.amount,
                        sales_count: item.salesCount,
                        note: item.note
                    });
                
                if (error) throw error;
            }
            
            successCount++;
        } catch (error) {
            console.error('Error uploading row:', item, error);
            errorCount++;
        }
        
        // 진행률 업데이트
        const progress = Math.round(((i + 1) / validData.length) * 100);
        progressFill.style.width = progress + '%';
        progressText.textContent = `업로드 중... ${progress}% (${i + 1}/${validData.length})`;
    }
    
    // 완료
    uploadProgress.style.display = 'none';
    bulkUploadBtn.disabled = false;
    
    if (errorCount > 0) {
        showBulkMessage(`완료: ${successCount}건 성공, ${errorCount}건 실패`, 'error');
    } else {
        showBulkMessage(`${successCount}건의 매출 데이터가 성공적으로 등록되었습니다.`, 'success');
    }
    
    // 초기화
    clearBulkForm();
});

// 일괄 등록 폼 초기화
function clearBulkForm() {
    pasteArea.value = '';
    parsedData = [];
    previewSection.style.display = 'none';
    bulkUploadBtn.disabled = true;
    progressFill.style.width = '0%';
}

clearBulkBtn.addEventListener('click', clearBulkForm);
clearPreviewBtn.addEventListener('click', clearBulkForm);

// 벌크 메시지 표시
function showBulkMessage(text, type) {
    bulkMessageEl.textContent = text;
    bulkMessageEl.className = `message ${type}`;
    
    setTimeout(() => {
        bulkMessageEl.className = 'message';
    }, 5000);
}

// 고객 선택 옵션 동기화 (모든 탭의 고객 선택 드롭다운 업데이트)
function syncCustomerSelects(customers) {
    populateCustomerSelect(customers);
}

// ========================================
// 파일 업로드 기능
// ========================================

// 파일 선택 버튼 클릭
fileSelectBtn.addEventListener('click', () => {
    fileUpload.click();
});

// 파일 선택 변경
fileUpload.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    fileName.textContent = file.name;
    fileMessage.className = 'message';
    fileMessage.textContent = '';
    fileParsedData = [];
    filePreviewSection.style.display = 'none';
    fileUploadBtn.disabled = true;
    
    try {
        const fileType = file.name.split('.').pop().toLowerCase();
        
        if (fileType === 'xlsx' || fileType === 'xls') {
            await parseExcelFile(file);
        } else if (fileType === 'pdf') {
            await parsePDFFile(file);
        } else {
            showFileMessage('지원하지 않는 파일 형식입니다. 엑셀(.xlsx, .xls) 또는 PDF(.pdf) 파일을 업로드해주세요.', 'error');
            return;
        }
        
        if (fileParsedData.length > 0) {
            displayFilePreview(fileParsedData);
            fileUploadBtn.disabled = !fileCustomerSelect.value;
        } else {
            showFileMessage('파일에서 매출 데이터를 찾을 수 없습니다. 파일 형식을 확인해주세요.', 'error');
        }
    } catch (error) {
        console.error('Error parsing file:', error);
        showFileMessage('파일 파싱 중 오류가 발생했습니다: ' + error.message, 'error');
    }
});

// 고객 선택 변경 시 업로드 버튼 활성화
fileCustomerSelect.addEventListener('change', () => {
    fileUploadBtn.disabled = !fileCustomerSelect.value || fileParsedData.length === 0;
});

// 엑셀 파일 파싱
async function parseExcelFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                
                fileParsedData = [];
                
                // 모든 시트를 순회
                workbook.SheetNames.forEach(sheetName => {
                    const worksheet = workbook.Sheets[sheetName];
                    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
                    
                    // 데이터 파싱
                    jsonData.forEach((row, rowIndex) => {
                        if (rowIndex === 0) return; // 헤더 스킵
                        
                        const parsed = parseRowData(row);
                        if (parsed) {
                            fileParsedData.push(parsed);
                        }
                    });
                });
                
                resolve();
            } catch (error) {
                reject(error);
            }
        };
        
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}

// PDF 파일 파싱
async function parsePDFFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = async (e) => {
            try {
                const typedArray = new Uint8Array(e.target.result);
                const pdf = await pdfjsLib.getDocument({ data: typedArray }).promise;
                
                fileParsedData = [];
                let fullText = '';
                
                // 모든 페이지 텍스트 추출
                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const textContent = await page.getTextContent();
                    const pageText = textContent.items.map(item => item.str).join(' ');
                    fullText += pageText + '\n';
                }
                
                // 텍스트를 줄 단위로 분리하여 파싱
                const lines = fullText.split('\n').filter(line => line.trim());
                
                lines.forEach(line => {
                    const parsed = parseRowData(line.split(/\s+/));
                    if (parsed) {
                        fileParsedData.push(parsed);
                    }
                });
                
                resolve();
            } catch (error) {
                reject(error);
            }
        };
        
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}

// 행 데이터 파싱 (날짜, 매출액, 카테고리 추출)
function parseRowData(row) {
    if (!row || row.length < 2) return null;
    
    let year = null;
    let month = null;
    let amount = null;
    let category = null;
    
    // 배열이 아닌 경우 공백으로 분리
    const data = Array.isArray(row) ? row : (typeof row === 'string' ? row.split(/\s+/) : [row]);
    
    // 숫자와 날짜 패턴 찾기
    for (let i = 0; i < data.length; i++) {
        const item = String(data[i]).trim().replace(/,/g, '');
        
        // 날짜 패턴: YYYYMMDD 또는 YYYY-MM-DD
        if (/^\d{8}$/.test(item)) {
            year = parseInt(item.substring(0, 4));
            month = parseInt(item.substring(4, 6));
        } else if (/^\d{4}-\d{2}-\d{2}$/.test(item)) {
            const parts = item.split('-');
            year = parseInt(parts[0]);
            month = parseInt(parts[1]);
        } else if (/^\d{4}$/.test(item) && !year) {
            year = parseInt(item);
        } else if (/^[1-9]|1[0-2]$/.test(item) && !month && year) {
            month = parseInt(item);
        }
        
        // 매출액 패턴 (큰 숫자)
        if (/^\d{6,}$/.test(item) && !amount) {
            amount = parseFloat(item);
        } else if (/^\d+\.?\d*$/.test(item) && parseFloat(item) > 1000 && !amount) {
            amount = parseFloat(item);
        }
        
        // 카테고리 (한글이나 영문 텍스트)
        if (!category && /[가-힣a-zA-Z]/.test(item) && !year && !month && !amount) {
            category = item;
        }
    }
    
    // 연도와 월이 없으면 현재 연도/월 사용
    if (!year) {
        const now = new Date();
        year = now.getFullYear();
    }
    if (!month) {
        month = new Date().getMonth() + 1;
    }
    
    // 매출액이 없으면 null 반환
    if (!amount || amount <= 0) return null;
    
    return {
        year,
        month,
        amount,
        category: category || '일반',
        salesCount: null,
        note: null
    };
}

// 파일 미리보기 표시
function displayFilePreview(data) {
    if (!data || data.length === 0) {
        filePreviewSection.style.display = 'none';
        return;
    }
    
    filePreviewCount.textContent = data.length;
    
    const tableHTML = `
        <table class="preview-table">
            <thead>
                <tr>
                    <th>연도</th>
                    <th>월</th>
                    <th>매출종류</th>
                    <th>매출액</th>
                </tr>
            </thead>
            <tbody>
                ${data.map(item => `
                    <tr>
                        <td>${item.year}년</td>
                        <td>${item.month}월</td>
                        <td>${item.category}</td>
                        <td>${formatCurrency(item.amount)}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
    
    filePreviewTable.innerHTML = tableHTML;
    filePreviewSection.style.display = 'block';
}

// 파일 업로드 버튼 클릭
fileUploadBtn.addEventListener('click', async () => {
    const userId = fileCustomerSelect.value;
    
    if (!userId) {
        showFileMessage('고객을 선택해주세요.', 'error');
        return;
    }
    
    if (fileParsedData.length === 0) {
        showFileMessage('등록할 데이터가 없습니다.', 'error');
        return;
    }
    
    fileUploadBtn.disabled = true;
    fileUploadProgress.style.display = 'block';
    fileProgressFill.style.width = '0%';
    fileProgressText.textContent = '업로드 중... 0%';
    
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < fileParsedData.length; i++) {
        const item = fileParsedData[i];
        
        try {
            // 기존 데이터 확인
            const { data: existing } = await supabaseClient
                .from('sales_reports')
                .select('id')
                .eq('user_id', userId)
                .eq('year', item.year)
                .eq('month', item.month)
                .eq('category', item.category)
                .single();
            
            if (existing) {
                // 업데이트
                const { error } = await supabaseClient
                    .from('sales_reports')
                    .update({
                        amount: item.amount,
                        sales_count: item.salesCount,
                        note: item.note,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', existing.id);
                
                if (error) throw error;
            } else {
                // 새로 등록
                const { error } = await supabaseClient
                    .from('sales_reports')
                    .insert({
                        user_id: userId,
                        year: item.year,
                        month: item.month,
                        category: item.category,
                        amount: item.amount,
                        sales_count: item.salesCount,
                        note: item.note
                    });
                
                if (error) throw error;
            }
            
            successCount++;
        } catch (error) {
            console.error('Error uploading row:', item, error);
            errorCount++;
        }
        
        // 진행률 업데이트
        const progress = Math.round(((i + 1) / fileParsedData.length) * 100);
        fileProgressFill.style.width = progress + '%';
        fileProgressText.textContent = `업로드 중... ${progress}% (${i + 1}/${fileParsedData.length})`;
    }
    
    // 완료
    fileUploadProgress.style.display = 'none';
    fileUploadBtn.disabled = false;
    
    if (errorCount > 0) {
        showFileMessage(`${successCount}건 등록 완료, ${errorCount}건 실패했습니다.`, 'error');
    } else {
        showFileMessage(`${successCount}건의 데이터가 성공적으로 등록되었습니다.`, 'success');
        // 초기화
        clearFileUpload();
    }
});

// 파일 업로드 초기화
clearFileBtn.addEventListener('click', clearFileUpload);
clearFilePreview.addEventListener('click', () => {
    fileParsedData = [];
    filePreviewSection.style.display = 'none';
    fileUploadBtn.disabled = true;
    fileName.textContent = '선택된 파일이 없습니다';
    fileUpload.value = '';
});

function clearFileUpload() {
    fileParsedData = [];
    filePreviewSection.style.display = 'none';
    fileUploadBtn.disabled = true;
    fileName.textContent = '선택된 파일이 없습니다';
    fileUpload.value = '';
    fileCustomerSelect.value = '';
    fileMessage.className = 'message';
    fileMessage.textContent = '';
}

// 파일 메시지 표시
function showFileMessage(message, type) {
    fileMessage.textContent = message;
    fileMessage.className = `message ${type}`;
    
    setTimeout(() => {
        fileMessage.className = 'message';
    }, 5000);
}

// 통화 포맷 함수
function formatCurrency(amount) {
    return '₩' + Math.round(amount).toLocaleString('ko-KR');
}
