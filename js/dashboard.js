// DOM Elements (DOMContentLoaded 이후에 초기화)
let userEmailEl, companyNameEl, logoutBtn, tableContainer, yearFilter, categoryFilter;
let compareYear1, compareYear2, compareBtn, pdfDownloadBtn;

// Stats Elements
let currentMonthSalesEl, lastMonthSalesEl, yearTotalSalesEl, avgMonthlySalesEl, salesChangeEl;

// Insight Elements
let selectedYearsEl, growthTitleEl, growthDescriptionEl, peakTitleEl, peakDescriptionEl, peakMonthEl;

// Modal Elements
let detailModal, modalTitle, modalBody, modalClose;

// 현재 사용자 정보
let currentUser = null;
let salesChart = null;
let allSalesData = {};

// 페이지 로드 시 인증 확인
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Supabase 클라이언트 확인
        if (!supabaseClient) {
            console.error('Supabase 클라이언트가 초기화되지 않았습니다.');
            alert('데이터베이스 연결 오류가 발생했습니다. 페이지를 새로고침해주세요.');
            return;
        }
        
        // DOM 요소 초기화
        initDOMElements();
        
        // 이벤트 리스너 설정
        setupEventListeners();
        
        // 인증 확인
        await checkAuth();
        
        // 사용자 정보가 있을 때만 데이터 로드
        if (currentUser && currentUser.id) {
            await loadAllSalesData();
            await loadSalesData();
            initChart();
        } else {
            console.warn('사용자 정보가 없어 데이터를 로드할 수 없습니다.');
        }
    } catch (error) {
        console.error('페이지 초기화 중 오류:', error);
        alert('페이지 로드 중 오류가 발생했습니다: ' + error.message);
    }
});

// DOM 요소 초기화
function initDOMElements() {
    userEmailEl = document.getElementById('userEmail');
    companyNameEl = document.getElementById('companyName');
    logoutBtn = document.getElementById('logoutBtn');
    tableContainer = document.getElementById('tableContainer');
    yearFilter = document.getElementById('yearFilter');
    categoryFilter = document.getElementById('categoryFilter');
    compareYear1 = document.getElementById('compareYear1');
    compareYear2 = document.getElementById('compareYear2');
    compareBtn = document.getElementById('compareBtn');
    pdfDownloadBtn = document.getElementById('pdfDownloadBtn');
    
    currentMonthSalesEl = document.getElementById('currentMonthSales');
    lastMonthSalesEl = document.getElementById('lastMonthSales');
    yearTotalSalesEl = document.getElementById('yearTotalSales');
    avgMonthlySalesEl = document.getElementById('avgMonthlySales');
    salesChangeEl = document.getElementById('salesChange');
    
    selectedYearsEl = document.getElementById('selectedYears');
    growthTitleEl = document.getElementById('growthTitle');
    growthDescriptionEl = document.getElementById('growthDescription');
    peakTitleEl = document.getElementById('peakTitle');
    peakDescriptionEl = document.getElementById('peakDescription');
    peakMonthEl = document.getElementById('peakMonth');
    
    // 모달 요소
    detailModal = document.getElementById('detailModal');
    modalTitle = document.getElementById('modalTitle');
    modalBody = document.getElementById('modalBody');
    modalClose = document.getElementById('modalClose');
}

// 이벤트 리스너 설정
function setupEventListeners() {
    // 로그아웃 버튼
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            console.log('로그아웃 버튼 클릭됨');
            
            try {
                this.disabled = true;
                this.textContent = '로그아웃 중...';
                
                const { error } = await supabaseClient.auth.signOut();
                
                if (error) {
                    console.error('로그아웃 오류:', error);
                    alert('로그아웃 중 오류가 발생했습니다. 다시 시도해주세요.');
                    this.disabled = false;
                    this.textContent = '로그아웃';
                    return;
                }
                
                console.log('로그아웃 성공, 페이지 이동');
                window.location.replace('index.html');
            } catch (err) {
                console.error('로그아웃 예외:', err);
                alert('로그아웃 중 오류가 발생했습니다.');
                this.disabled = false;
                this.textContent = '로그아웃';
            }
        });
    }
    
    // 연도 필터 변경
    if (yearFilter) {
        yearFilter.addEventListener('change', async () => {
            await loadSalesData();
        });
    }
    
    // 카테고리 필터 변경
    if (categoryFilter) {
        categoryFilter.addEventListener('change', async () => {
            await loadSalesData();
        });
    }
    
    // 비교 버튼 클릭
    if (compareBtn) {
        compareBtn.addEventListener('click', () => {
            updateChart();
            updateInsights();
        });
    }
    
    // PDF 다운로드 버튼 클릭
    if (pdfDownloadBtn) {
        pdfDownloadBtn.addEventListener('click', async () => {
            await downloadPDF();
        });
    }
    
    // 모달 닫기
    if (modalClose) {
        modalClose.addEventListener('click', () => {
            detailModal.classList.remove('active');
        });
    }
    
    if (detailModal) {
        detailModal.addEventListener('click', (e) => {
            if (e.target === detailModal) {
                detailModal.classList.remove('active');
            }
        });
    }
}

// 인증 확인
async function checkAuth() {
    try {
        if (!supabaseClient) {
            console.error('Supabase 클라이언트가 초기화되지 않았습니다.');
            alert('데이터베이스 연결 오류가 발생했습니다. 페이지를 새로고침해주세요.');
            return;
        }
        
        const { data: { session }, error } = await supabaseClient.auth.getSession();
        
        if (error) {
            console.error('세션 확인 오류:', error);
            alert('인증 확인 중 오류가 발생했습니다: ' + error.message);
            return;
        }
        
        if (!session) {
            window.location.href = 'index.html';
            return;
        }
        
        currentUser = session.user;
        if (userEmailEl) userEmailEl.textContent = currentUser.email;
        if (companyNameEl) companyNameEl.textContent = currentUser.user_metadata?.company_name || '고객';
    } catch (error) {
        console.error('인증 확인 중 예외 발생:', error);
        alert('인증 확인 중 오류가 발생했습니다: ' + error.message);
    }
}

// 모든 연도의 매출 데이터 로드
async function loadAllSalesData() {
    try {
        if (!supabaseClient) {
            console.error('Supabase 클라이언트가 초기화되지 않았습니다.');
            return;
        }
        
        if (!currentUser || !currentUser.id) {
            console.error('사용자 정보가 없습니다.');
            return;
        }
        
        const { data: salesData, error } = await supabaseClient
            .from('sales_reports')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('year', { ascending: true })
            .order('month', { ascending: true });
        
        if (error) {
            console.error('매출 데이터 로드 오류:', error);
            
            // 테이블이 없는 경우
            if (error.code === '42P01' || error.message.includes('does not exist')) {
                console.warn('sales_reports 테이블이 존재하지 않습니다.');
                allSalesData = {};
                return;
            }
            
            // RLS 정책 오류
            if (error.code === '42501' || error.message.includes('permission denied')) {
                console.warn('데이터 접근 권한이 없습니다.');
                allSalesData = {};
                return;
            }
            
            throw error;
        }
        
        // 연도별로 데이터 정리
        allSalesData = {};
        const categories = new Set();
        
        if (salesData && salesData.length > 0) {
            salesData.forEach(item => {
                if (!allSalesData[item.year]) {
                    allSalesData[item.year] = [];
                }
                allSalesData[item.year].push(item);
                
                // 카테고리 수집
                if (item.category) {
                    categories.add(item.category);
                }
            });
        }
        
        // 카테고리 필터 업데이트
        if (categoryFilter) {
            updateCategoryFilter(Array.from(categories));
        }
        
    } catch (error) {
        console.error('Error loading all sales data:', error);
        allSalesData = {};
    }
}

// 카테고리 필터 업데이트
function updateCategoryFilter(categories) {
    categoryFilter.innerHTML = '<option value="summary">월별 합계</option><option value="all">전체 (종류별 상세)</option>';
    
    categories.sort().forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat;
        categoryFilter.appendChild(option);
    });
}

// 매출 데이터 로드
async function loadSalesData() {
    if (!tableContainer || !yearFilter || !categoryFilter) {
        console.error('필수 DOM 요소가 없습니다.');
        return;
    }
    
    const selectedYear = yearFilter.value;
    const selectedCategory = categoryFilter.value;
    
    tableContainer.innerHTML = `
        <div class="loading">
            <div class="spinner"></div>
        </div>
    `;
    
    try {
        if (!supabaseClient) {
            throw new Error('Supabase 클라이언트가 초기화되지 않았습니다.');
        }
        
        if (!currentUser || !currentUser.id) {
            throw new Error('사용자 정보가 없습니다.');
        }
        
        let query = supabaseClient
            .from('sales_reports')
            .select('*')
            .eq('user_id', currentUser.id)
            .eq('year', selectedYear)
            .order('month', { ascending: true })
            .order('category', { ascending: true });
        
        // 카테고리 필터 적용 (summary와 all은 전체 데이터 필요)
        if (selectedCategory !== 'all' && selectedCategory !== 'summary') {
            query = query.eq('category', selectedCategory);
        }
        
        const { data: salesData, error } = await query;
        
        if (error) {
            console.error('매출 데이터 조회 오류:', error);
            
            // 테이블이 없는 경우
            if (error.code === '42P01' || error.message.includes('does not exist')) {
                tableContainer.innerHTML = `
                    <div class="empty-state">
                        <h4>📋 데이터베이스 테이블이 없습니다</h4>
                        <p>Supabase에서 sales_reports 테이블을 생성해주세요.</p>
                    </div>
                `;
                return;
            }
            
            // RLS 정책 오류
            if (error.code === '42501' || error.message.includes('permission denied')) {
                tableContainer.innerHTML = `
                    <div class="empty-state">
                        <h4>🔒 데이터 접근 권한이 없습니다</h4>
                        <p>데이터베이스 접근 권한을 확인해주세요.</p>
                    </div>
                `;
                return;
            }
            
            throw error;
        }
        
        displaySalesData(salesData, selectedYear, selectedCategory);
        updateStats(salesData);
        
    } catch (error) {
        console.error('Error loading sales data:', error);
        tableContainer.innerHTML = `
            <div class="empty-state">
                <h4>❌ 데이터 로드 오류</h4>
                <p>데이터를 불러오는 중 오류가 발생했습니다: ${error.message}</p>
                <p style="font-size: 12px; color: #64748b; margin-top: 8px;">페이지를 새로고침하거나 관리자에게 문의해주세요.</p>
            </div>
        `;
    }
}

// 매출 데이터 테이블 표시
function displaySalesData(data, year, selectedCategory) {
    if (!data || data.length === 0) {
        displayEmptyState();
        return;
    }
    
    // 월별 합계 보기
    if (selectedCategory === 'summary') {
        displayMonthlySummary(data, year);
        return;
    }
    
    // 전체 보기일 때는 카테고리 컬럼 표시
    const showCategory = selectedCategory === 'all';
    
    const tableHTML = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>월</th>
                    ${showCategory ? '<th>매출종류</th>' : ''}
                    <th>매출액</th>
                    <th>판매건수</th>
                    <th>비고</th>
                </tr>
            </thead>
            <tbody>
                ${data.map(row => `
                    <tr>
                        <td>${year}년 ${row.month}월</td>
                        ${showCategory ? `<td><span class="category-tag">${row.category || '일반'}</span></td>` : ''}
                        <td class="amount">${formatCurrency(row.amount)}</td>
                        <td>${row.sales_count || '-'}</td>
                        <td>${row.note || '-'}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
        <div class="table-summary">
            <span>총 ${data.length}건</span>
            <span class="summary-amount">합계: ${formatCurrency(data.reduce((sum, row) => sum + (row.amount || 0), 0))}</span>
        </div>
    `;
    
    tableContainer.innerHTML = tableHTML;
}

// 월별 합계 표시
function displayMonthlySummary(data, year) {
    // 월별로 데이터 합산
    const monthlyData = {};
    
    data.forEach(row => {
        if (!monthlyData[row.month]) {
            monthlyData[row.month] = {
                amount: 0,
                salesCount: 0,
                categories: []
            };
        }
        monthlyData[row.month].amount += row.amount || 0;
        monthlyData[row.month].salesCount += row.sales_count || 0;
        if (row.category && !monthlyData[row.month].categories.includes(row.category)) {
            monthlyData[row.month].categories.push(row.category);
        }
    });
    
    // 월 순서대로 정렬
    const sortedMonths = Object.keys(monthlyData).map(Number).sort((a, b) => a - b);
    
    const totalAmount = sortedMonths.reduce((sum, month) => sum + monthlyData[month].amount, 0);
    const totalCount = sortedMonths.reduce((sum, month) => sum + monthlyData[month].salesCount, 0);
    
    const tableHTML = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>월</th>
                    <th>매출액</th>
                    <th>판매건수</th>
                    <th>매출종류</th>
                </tr>
            </thead>
            <tbody>
                ${sortedMonths.map(month => `
                    <tr>
                        <td>${year}년 ${month}월</td>
                        <td class="amount">${formatCurrency(monthlyData[month].amount)}</td>
                        <td>${monthlyData[month].salesCount || '-'}</td>
                        <td>${monthlyData[month].categories.length > 0 ? monthlyData[month].categories.map(c => `<span class="category-tag">${c}</span>`).join(' ') : '-'}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
        <div class="table-summary">
            <span>총 ${sortedMonths.length}개월</span>
            <span class="summary-amount">연간 합계: ${formatCurrency(totalAmount)}</span>
        </div>
    `;
    
    tableContainer.innerHTML = tableHTML;
}

// 빈 상태 표시
function displayEmptyState() {
    tableContainer.innerHTML = `
        <div class="empty-state">
            <h4>📭 데이터가 없습니다</h4>
            <p>선택한 기간의 매출 데이터가 없습니다.</p>
        </div>
    `;
    
    currentMonthSalesEl.textContent = '₩0';
    lastMonthSalesEl.textContent = '₩0';
    yearTotalSalesEl.textContent = '₩0';
    avgMonthlySalesEl.textContent = '₩0';
    salesChangeEl.textContent = '전월 대비 -';
}

// 통계 업데이트
function updateStats(data) {
    const selectedYear = parseInt(yearFilter.value);
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    
    // 연도 정보 업데이트
    document.getElementById('yearInfo').textContent = `${selectedYear}년 누적`;
    
    if (!data || data.length === 0) {
        currentMonthSalesEl.textContent = '₩0';
        lastMonthSalesEl.textContent = '₩0';
        yearTotalSalesEl.textContent = '₩0';
        avgMonthlySalesEl.textContent = '₩0';
        salesChangeEl.textContent = '전월 대비 -';
        salesChangeEl.className = 'change';
        return;
    }
    
    // 월별 합계 계산 (카테고리별 데이터를 월별로 합산)
    const monthlyTotals = {};
    data.forEach(d => {
        if (!monthlyTotals[d.month]) {
            monthlyTotals[d.month] = 0;
        }
        monthlyTotals[d.month] += d.amount || 0;
    });
    
    // 선택된 연도가 현재 연도인 경우에만 이번 달/지난 달 표시
    let currentMonthSales = 0;
    let lastMonthSales = 0;
    
    if (selectedYear === currentYear) {
        currentMonthSales = monthlyTotals[currentMonth] || 0;
        lastMonthSales = monthlyTotals[currentMonth - 1] || 0;
    } else {
        // 과거 연도인 경우 12월과 11월 표시
        currentMonthSales = monthlyTotals[12] || 0;
        lastMonthSales = monthlyTotals[11] || 0;
    }
    
    currentMonthSalesEl.textContent = formatCurrency(currentMonthSales);
    lastMonthSalesEl.textContent = formatCurrency(lastMonthSales);
    
    if (lastMonthSales > 0) {
        const changePercent = ((currentMonthSales - lastMonthSales) / lastMonthSales * 100).toFixed(1);
        const isPositive = changePercent >= 0;
        salesChangeEl.textContent = `전월 대비 ${isPositive ? '+' : ''}${changePercent}%`;
        salesChangeEl.className = isPositive ? 'change' : 'change negative';
    } else {
        salesChangeEl.textContent = '전월 대비 -';
        salesChangeEl.className = 'change';
    }
    
    // 연간 총 매출
    const yearTotal = Object.values(monthlyTotals).reduce((sum, amount) => sum + amount, 0);
    yearTotalSalesEl.textContent = formatCurrency(yearTotal);
    
    // 평균 월 매출 (데이터가 있는 월 기준)
    const monthsWithData = Object.keys(monthlyTotals).length;
    const avgSales = monthsWithData > 0 ? yearTotal / monthsWithData : 0;
    avgMonthlySalesEl.textContent = formatCurrency(avgSales);
}

// 차트 초기화
function initChart() {
    const ctx = document.getElementById('salesChart').getContext('2d');
    
    salesChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'],
            datasets: []
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index'
            },
            onClick: (event, elements) => {
                if (elements.length > 0) {
                    const element = elements[0];
                    const monthIndex = element.index;
                    const month = monthIndex + 1;
                    // 현재 비교 중인 두 연도를 모두 전달
                    const year1 = parseInt(compareYear1.value);
                    const year2 = parseInt(compareYear2.value);
                    showMonthComparison(month, year1, year2);
                }
            },
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        usePointStyle: true,
                        padding: 20,
                        font: {
                            family: "'Noto Sans KR', sans-serif",
                            size: 13
                        }
                    }
                },
                tooltip: {
                    backgroundColor: 'white',
                    titleColor: '#1e293b',
                    bodyColor: '#64748b',
                    borderColor: '#e2e8f0',
                    borderWidth: 1,
                    padding: 12,
                    titleFont: {
                        family: "'Noto Sans KR', sans-serif",
                        size: 14,
                        weight: 'bold'
                    },
                    bodyFont: {
                        family: "'Noto Sans KR', sans-serif",
                        size: 13
                    },
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${formatCurrency(context.raw)}`;
                        },
                        footer: function() {
                            return '클릭하여 연도별 비교';
                        }
                    },
                    footerFont: {
                        family: "'Noto Sans KR', sans-serif",
                        size: 11,
                        style: 'italic'
                    },
                    footerColor: '#94a3b8'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return formatCompactCurrency(value);
                        },
                        font: {
                            family: "'Noto Sans KR', sans-serif"
                        }
                    },
                    grid: {
                        color: '#f1f5f9'
                    }
                },
                x: {
                    ticks: {
                        font: {
                            family: "'Noto Sans KR', sans-serif"
                        }
                    },
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
    
    updateChart();
    updateInsights();
}

// 월별 연도 비교 보기
async function showMonthComparison(month, year1, year2) {
    modalTitle.textContent = `${month}월 연도별 매출 비교`;
    modalBody.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    detailModal.classList.add('active');
    
    try {
        // 두 연도의 해당 월 데이터 조회
        const { data, error } = await supabaseClient
            .from('sales_reports')
            .select('*')
            .eq('user_id', currentUser.id)
            .eq('month', month)
            .in('year', [year1, year2])
            .order('year', { ascending: false })
            .order('category', { ascending: true });
        
        if (error) throw error;
        
        // 연도별로 데이터 분류
        const dataByYear = {};
        dataByYear[year1] = [];
        dataByYear[year2] = [];
        
        if (data) {
            data.forEach(item => {
                if (dataByYear[item.year]) {
                    dataByYear[item.year].push(item);
                }
            });
        }
        
        // 연도별 총액 계산
        const total1 = dataByYear[year1].reduce((sum, item) => sum + (item.amount || 0), 0);
        const total2 = dataByYear[year2].reduce((sum, item) => sum + (item.amount || 0), 0);
        const diff = total1 - total2;
        const changePercent = total2 > 0 ? ((diff / total2) * 100).toFixed(1) : (total1 > 0 ? 100 : 0);
        const isGrowth = diff >= 0;
        
        // 카테고리별 비교 데이터 생성
        const categories = new Set();
        [...dataByYear[year1], ...dataByYear[year2]].forEach(item => {
            categories.add(item.category || '일반');
        });
        
        const categoryComparison = Array.from(categories).map(cat => {
            const item1 = dataByYear[year1].find(d => (d.category || '일반') === cat);
            const item2 = dataByYear[year2].find(d => (d.category || '일반') === cat);
            const amount1 = item1?.amount || 0;
            const amount2 = item2?.amount || 0;
            const catDiff = amount1 - amount2;
            return { category: cat, amount1, amount2, diff: catDiff };
        });
        
        modalBody.innerHTML = `
            <div class="comparison-summary">
                <div class="comparison-card year1">
                    <div class="comparison-year">${year1}년 ${month}월</div>
                    <div class="comparison-amount">${formatCurrency(total1)}</div>
                    <div class="comparison-count">${dataByYear[year1].length}개 항목</div>
                </div>
                <div class="comparison-vs">
                    <div class="vs-icon">VS</div>
                    <div class="vs-change ${isGrowth ? 'positive' : 'negative'}">
                        ${isGrowth ? '▲' : '▼'} ${Math.abs(changePercent)}%
                    </div>
                </div>
                <div class="comparison-card year2">
                    <div class="comparison-year">${year2}년 ${month}월</div>
                    <div class="comparison-amount">${formatCurrency(total2)}</div>
                    <div class="comparison-count">${dataByYear[year2].length}개 항목</div>
                </div>
            </div>
            
            <div class="comparison-diff ${isGrowth ? 'positive' : 'negative'}">
                <span>전년 대비</span>
                <span class="diff-amount">${isGrowth ? '+' : ''}${formatCurrency(diff)}</span>
            </div>
            
            ${categoryComparison.length > 0 ? `
                <h4 class="comparison-table-title">카테고리별 비교</h4>
                <table class="detail-table comparison-table">
                    <thead>
                        <tr>
                            <th>매출종류</th>
                            <th>${year1}년</th>
                            <th>${year2}년</th>
                            <th>증감</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${categoryComparison.map(item => `
                            <tr>
                                <td>${item.category}</td>
                                <td class="amount">${formatCurrency(item.amount1)}</td>
                                <td class="amount">${formatCurrency(item.amount2)}</td>
                                <td class="diff-cell ${item.diff >= 0 ? 'positive' : 'negative'}">
                                    ${item.diff >= 0 ? '+' : ''}${formatCurrency(item.diff)}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            ` : `
                <div class="empty-detail">
                    <p>📭 비교할 매출 데이터가 없습니다.</p>
                </div>
            `}
        `;
        
    } catch (error) {
        console.error('Error loading comparison:', error);
        modalBody.innerHTML = `
            <div class="empty-detail">
                <p>데이터를 불러오는 중 오류가 발생했습니다.</p>
            </div>
        `;
    }
}

// 차트 업데이트
function updateChart() {
    const year1 = compareYear1.value;
    const year2 = compareYear2.value;
    
    selectedYearsEl.textContent = `${year2}-${year1}`;
    document.getElementById('chartTitle').textContent = `${year2}-${year1} 월별 매출 비교 (단위: 원)`;
    
    const data1 = getYearlyData(year1);
    const data2 = getYearlyData(year2);
    
    salesChart.data.datasets = [
        {
            label: `${year1} 매출`,
            data: data1,
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            borderWidth: 3,
            pointBackgroundColor: '#3b82f6',
            pointBorderColor: 'white',
            pointBorderWidth: 2,
            pointRadius: 5,
            pointHoverRadius: 7,
            tension: 0.3,
            fill: false
        },
        {
            label: `${year2} 매출`,
            data: data2,
            borderColor: '#f59e0b',
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            borderWidth: 3,
            pointBackgroundColor: '#f59e0b',
            pointBorderColor: 'white',
            pointBorderWidth: 2,
            pointRadius: 5,
            pointHoverRadius: 7,
            tension: 0.3,
            fill: false
        }
    ];
    
    salesChart.update();
}

// 연도별 데이터 가져오기 (월별 합산)
function getYearlyData(year) {
    const yearData = allSalesData[year] || [];
    const monthlyData = new Array(12).fill(0);
    
    // 같은 월의 여러 카테고리 데이터를 합산
    yearData.forEach(item => {
        const monthIndex = item.month - 1;
        if (monthIndex >= 0 && monthIndex < 12) {
            monthlyData[monthIndex] += parseFloat(item.amount) || 0;
        }
    });
    
    return monthlyData;
}

// 인사이트 업데이트
function updateInsights() {
    const year1 = compareYear1.value;
    const year2 = compareYear2.value;
    
    const data1 = getYearlyData(year1);
    const data2 = getYearlyData(year2);
    
    const total1 = data1.reduce((a, b) => a + b, 0);
    const total2 = data2.reduce((a, b) => a + b, 0);
    
    // 성장률 계산
    let growthRate = 0;
    if (total2 > 0) {
        growthRate = ((total1 - total2) / total2 * 100).toFixed(1);
    }
    
    // 연간 매출 성장 인사이트
    if (total1 > 0 || total2 > 0) {
        growthTitleEl.textContent = `${year1}년 연간 총 매출, 전년 대비 약 ${Math.abs(growthRate)}% ${growthRate >= 0 ? '성장' : '감소'}`;
        growthDescriptionEl.textContent = `${year2}년 총 매출 약 ${formatCompactCurrency(total2)}에서 ${year1}년 약 ${formatCompactCurrency(total1)}${growthRate >= 0 ? '으로 증가했습니다.' : '으로 감소했습니다.'}`;
    } else {
        growthTitleEl.textContent = '매출 데이터가 없습니다';
        growthDescriptionEl.textContent = '관리자에게 매출 데이터 등록을 요청하세요.';
    }
    
    // 최고 매출 월 찾기 (월별 합산 데이터 사용)
    const positiveData1 = data1.filter(v => v > 0);
    const positiveData2 = data2.filter(v => v > 0);
    
    if (positiveData1.length > 0 || positiveData2.length > 0) {
        const max1 = positiveData1.length > 0 ? Math.max(...positiveData1) : 0;
        const max2 = positiveData2.length > 0 ? Math.max(...positiveData2) : 0;
        const maxMonth1 = max1 > 0 ? data1.indexOf(max1) + 1 : 0;
        const maxMonth2 = max2 > 0 ? data2.indexOf(max2) + 1 : 0;
        
        if (maxMonth1 === maxMonth2 && max1 > 0 && max2 > 0) {
            peakTitleEl.textContent = `두 해 모두 ${maxMonth1}월에 최고 매출 기록`;
            peakDescriptionEl.textContent = `${maxMonth1}월 최고 매출: ${year2}년 ${formatCurrency(max2)}, ${year1}년 ${formatCurrency(max1)}으로 ${maxMonth1}월에 매출이 집중되었습니다.`;
        } else if (max1 > 0) {
            peakTitleEl.textContent = `${year1}년 최고 매출: ${maxMonth1}월`;
            peakDescriptionEl.textContent = `${year1}년 ${maxMonth1}월에 ${formatCurrency(max1)}로 최고 매출을 기록했습니다.`;
        } else {
            peakTitleEl.textContent = `${year2}년 최고 매출: ${maxMonth2}월`;
            peakDescriptionEl.textContent = `${year2}년 ${maxMonth2}월에 ${formatCurrency(max2)}로 최고 매출을 기록했습니다.`;
        }
        peakMonthEl.textContent = maxMonth1 > 0 ? `${maxMonth1}월` : (maxMonth2 > 0 ? `${maxMonth2}월` : '-월');
    } else {
        peakTitleEl.textContent = '최고 매출 월';
        peakDescriptionEl.textContent = '데이터가 없습니다.';
        peakMonthEl.textContent = '-월';
    }
}

// 통화 포맷
function formatCurrency(amount) {
    return '₩' + Math.round(amount).toLocaleString('ko-KR');
}

// 간략한 통화 포맷 (억, 만)
function formatCompactCurrency(amount) {
    if (amount >= 100000000) {
        return (amount / 100000000).toFixed(1) + '억 원';
    } else if (amount >= 10000000) {
        return (amount / 10000000).toFixed(1) + '천만 원';
    } else if (amount >= 10000) {
        return (amount / 10000).toFixed(0) + '만 원';
    }
    return formatCurrency(amount);
}

// PDF 다운로드 함수
async function downloadPDF() {
    if (!window.jspdf || !html2canvas) {
        alert('PDF 생성 라이브러리를 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
        return;
    }
    
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 15;
    let yPosition = margin;
    
    // 로딩 표시
    pdfDownloadBtn.disabled = true;
    pdfDownloadBtn.textContent = 'PDF 생성 중...';
    
    try {
        const companyName = companyNameEl.textContent || '고객';
        const year1 = compareYear1.value;
        const year2 = compareYear2.value;
        const data1 = getYearlyData(year1);
        const data2 = getYearlyData(year2);
        const total1 = data1.reduce((a, b) => a + b, 0);
        const total2 = data2.reduce((a, b) => a + b, 0);
        const growthRate = total2 > 0 ? ((total1 - total2) / total2 * 100).toFixed(1) : 0;
        
        // 1. 헤더 정보 (이미지로 변환)
        const headerHTML = `
            <div style="font-family: 'Noto Sans KR', sans-serif; text-align: center; padding: 20px; background: white;">
                <h1 style="font-size: 24px; font-weight: bold; margin: 0 0 10px 0; color: #1e293b;">
                    ${companyName} ${year2}-${year1} 매출 비교 리포트
                </h1>
                <p style="font-size: 12px; color: #64748b; margin: 0;">
                    생성일: ${new Date().toLocaleDateString('ko-KR')}
                </p>
            </div>
        `;
        
        const headerDiv = document.createElement('div');
        headerDiv.innerHTML = headerHTML;
        headerDiv.style.position = 'absolute';
        headerDiv.style.left = '-9999px';
        headerDiv.style.width = '210mm';
        document.body.appendChild(headerDiv);
        
        try {
            const headerImage = await html2canvas(headerDiv, {
                backgroundColor: '#ffffff',
                scale: 2,
                logging: false
            });
            
            const headerImgData = headerImage.toDataURL('image/png');
            const headerImgWidth = pageWidth - (margin * 2);
            const headerImgHeight = (headerImage.height * headerImgWidth) / headerImage.width;
            
            pdf.addImage(headerImgData, 'PNG', margin, yPosition, headerImgWidth, headerImgHeight);
            yPosition += headerImgHeight + 10;
        } catch (error) {
            console.error('Error capturing header:', error);
            yPosition += 20;
        } finally {
            document.body.removeChild(headerDiv);
        }
        
        // 2. 요약 정보 카드 (이미지로 변환)
        const summaryHTML = `
            <div style="font-family: 'Noto Sans KR', sans-serif; padding: 20px; background: white; border-radius: 8px;">
                <h2 style="font-size: 16px; font-weight: bold; margin: 0 0 15px 0; color: #1e293b;">📊 요약 정보</h2>
                <ul style="list-style: none; padding: 0; margin: 0; font-size: 14px; color: #334155; line-height: 1.8;">
                    <li>• ${year1}년 총 매출: ${formatCurrency(total1)}</li>
                    <li>• ${year2}년 총 매출: ${formatCurrency(total2)}</li>
                    <li>• 전년 대비: ${growthRate >= 0 ? '+' : ''}${growthRate}% ${growthRate >= 0 ? '성장' : '감소'}</li>
                </ul>
            </div>
        `;
        
        const summaryDiv = document.createElement('div');
        summaryDiv.innerHTML = summaryHTML;
        summaryDiv.style.position = 'absolute';
        summaryDiv.style.left = '-9999px';
        summaryDiv.style.width = '180mm';
        document.body.appendChild(summaryDiv);
        
        try {
            const summaryImage = await html2canvas(summaryDiv, {
                backgroundColor: '#ffffff',
                scale: 2,
                logging: false
            });
            
            const summaryImgData = summaryImage.toDataURL('image/png');
            const summaryImgWidth = pageWidth - (margin * 2);
            const summaryImgHeight = (summaryImage.height * summaryImgWidth) / summaryImage.width;
            
            if (yPosition + summaryImgHeight > pageHeight - margin) {
                pdf.addPage();
                yPosition = margin;
            }
            
            pdf.addImage(summaryImgData, 'PNG', margin, yPosition, summaryImgWidth, summaryImgHeight);
            yPosition += summaryImgHeight + 10;
        } catch (error) {
            console.error('Error capturing summary:', error);
            yPosition += 30;
        } finally {
            document.body.removeChild(summaryDiv);
        }
        
        // 3. 차트 이미지 추가
        const chartCanvas = document.getElementById('salesChart');
        if (chartCanvas) {
            // 차트 제목 추가
            const chartTitleHTML = `
                <div style="font-family: 'Noto Sans KR', sans-serif; padding: 10px 0; background: white;">
                    <h2 style="font-size: 16px; font-weight: bold; margin: 0; color: #1e293b;">📈 월별 매출 비교 차트</h2>
                </div>
            `;
            
            const chartTitleDiv = document.createElement('div');
            chartTitleDiv.innerHTML = chartTitleHTML;
            chartTitleDiv.style.position = 'absolute';
            chartTitleDiv.style.left = '-9999px';
            chartTitleDiv.style.width = '180mm';
            document.body.appendChild(chartTitleDiv);
            
            try {
                const chartTitleImage = await html2canvas(chartTitleDiv, {
                    backgroundColor: '#ffffff',
                    scale: 2,
                    logging: false
                });
                
                const chartTitleImgData = chartTitleImage.toDataURL('image/png');
                const chartTitleImgWidth = pageWidth - (margin * 2);
                const chartTitleImgHeight = (chartTitleImage.height * chartTitleImgWidth) / chartTitleImage.width;
                
                if (yPosition + chartTitleImgHeight > pageHeight - margin) {
                    pdf.addPage();
                    yPosition = margin;
                }
                
                pdf.addImage(chartTitleImgData, 'PNG', margin, yPosition, chartTitleImgWidth, chartTitleImgHeight);
                yPosition += chartTitleImgHeight + 5;
                document.body.removeChild(chartTitleDiv);
            } catch (error) {
                document.body.removeChild(chartTitleDiv);
            }
            
            try {
                const chartImage = await html2canvas(chartCanvas, {
                    backgroundColor: '#ffffff',
                    scale: 2,
                    logging: false
                });
                
                const imgData = chartImage.toDataURL('image/png');
                const imgWidth = pageWidth - (margin * 2);
                const imgHeight = (chartImage.height * imgWidth) / chartImage.width;
                
                // 페이지 넘김 체크
                if (yPosition + imgHeight > pageHeight - margin) {
                    pdf.addPage();
                    yPosition = margin;
                }
                
                pdf.addImage(imgData, 'PNG', margin, yPosition, imgWidth, imgHeight);
                yPosition += imgHeight + 10;
            } catch (error) {
                console.error('Error capturing chart:', error);
            }
        }
        
        // 4. 월별 매출 데이터 테이블 (이미지로 변환)
        if (yPosition > pageHeight - 50) {
            pdf.addPage();
            yPosition = margin;
        }
        
        const months = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
        let tableRows = '';
        
        for (let i = 0; i < 12; i++) {
            const month1 = data1[i] || 0;
            const month2 = data2[i] || 0;
            const diff = month1 - month2;
            const changeRate = month2 > 0 ? ((diff / month2) * 100).toFixed(1) : (month1 > 0 ? '100.0' : '0.0');
            
            tableRows += `
                <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 8px; text-align: left;">${months[i]}</td>
                    <td style="padding: 8px; text-align: right;">${formatCurrency(month1)}</td>
                    <td style="padding: 8px; text-align: right;">${formatCurrency(month2)}</td>
                    <td style="padding: 8px; text-align: right;">${formatCurrency(diff)}</td>
                    <td style="padding: 8px; text-align: right;">${changeRate >= 0 ? '+' : ''}${changeRate}%</td>
                </tr>
            `;
        }
        
        const tableHTML = `
            <div style="font-family: 'Noto Sans KR', sans-serif; padding: 20px; background: white;">
                <h2 style="font-size: 16px; font-weight: bold; margin: 0 0 15px 0; color: #1e293b;">📋 월별 매출 상세</h2>
                <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                    <thead>
                        <tr style="background: #f8fafc; border-bottom: 2px solid #e2e8f0;">
                            <th style="padding: 10px; text-align: left; font-weight: 600; color: #475569;">월</th>
                            <th style="padding: 10px; text-align: right; font-weight: 600; color: #475569;">${year1}년</th>
                            <th style="padding: 10px; text-align: right; font-weight: 600; color: #475569;">${year2}년</th>
                            <th style="padding: 10px; text-align: right; font-weight: 600; color: #475569;">차이</th>
                            <th style="padding: 10px; text-align: right; font-weight: 600; color: #475569;">증감률</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRows}
                    </tbody>
                </table>
            </div>
        `;
        
        const tableDiv = document.createElement('div');
        tableDiv.innerHTML = tableHTML;
        tableDiv.style.position = 'absolute';
        tableDiv.style.left = '-9999px';
        tableDiv.style.width = '180mm';
        document.body.appendChild(tableDiv);
        
        try {
            const tableImage = await html2canvas(tableDiv, {
                backgroundColor: '#ffffff',
                scale: 2,
                logging: false
            });
            
            const tableImgData = tableImage.toDataURL('image/png');
            const tableImgWidth = pageWidth - (margin * 2);
            const tableImgHeight = (tableImage.height * tableImgWidth) / tableImage.width;
            
            if (yPosition + tableImgHeight > pageHeight - margin) {
                pdf.addPage();
                yPosition = margin;
            }
            
            pdf.addImage(tableImgData, 'PNG', margin, yPosition, tableImgWidth, tableImgHeight);
            yPosition += tableImgHeight + 10;
            document.body.removeChild(tableDiv);
        } catch (error) {
            console.error('Error capturing table:', error);
            document.body.removeChild(tableDiv);
            yPosition += 50;
        }
        
        // 5. 통계 카드 정보 (이미지로 변환)
        if (yPosition > pageHeight - 40) {
            pdf.addPage();
            yPosition = margin;
        }
        
        const currentMonth = new Date().getMonth() + 1;
        const currentYear = new Date().getFullYear();
        const statsSelectedYear = parseInt(yearFilter.value);
        
        let currentMonthSales = 0;
        let lastMonthSales = 0;
        
        if (statsSelectedYear === currentYear) {
            currentMonthSales = data1[currentMonth - 1] || 0;
            lastMonthSales = data1[currentMonth - 2] || 0;
        } else {
            currentMonthSales = data1[11] || 0;
            lastMonthSales = data1[10] || 0;
        }
        
        const monthsWithData = data1.filter(v => v > 0).length;
        const avgSales = monthsWithData > 0 ? total1 / monthsWithData : 0;
        
        const statsHTML = `
            <div style="font-family: 'Noto Sans KR', sans-serif; padding: 20px; background: white; border-radius: 8px;">
                <h2 style="font-size: 16px; font-weight: bold; margin: 0 0 15px 0; color: #1e293b;">💰 주요 통계</h2>
                <ul style="list-style: none; padding: 0; margin: 0; font-size: 14px; color: #334155; line-height: 1.8;">
                    <li>• 이번 달 매출: ${formatCurrency(currentMonthSales)}</li>
                    <li>• 지난 달 매출: ${formatCurrency(lastMonthSales)}</li>
                    <li>• 올해 누적 매출: ${formatCurrency(total1)}</li>
                    <li>• 평균 월 매출: ${formatCurrency(avgSales)}</li>
                </ul>
            </div>
        `;
        
        const statsDiv = document.createElement('div');
        statsDiv.innerHTML = statsHTML;
        statsDiv.style.position = 'absolute';
        statsDiv.style.left = '-9999px';
        statsDiv.style.width = '180mm';
        document.body.appendChild(statsDiv);
        
        try {
            const statsImage = await html2canvas(statsDiv, {
                backgroundColor: '#ffffff',
                scale: 2,
                logging: false
            });
            
            const statsImgData = statsImage.toDataURL('image/png');
            const statsImgWidth = pageWidth - (margin * 2);
            const statsImgHeight = (statsImage.height * statsImgWidth) / statsImage.width;
            
            if (yPosition + statsImgHeight > pageHeight - margin) {
                pdf.addPage();
                yPosition = margin;
            }
            
            pdf.addImage(statsImgData, 'PNG', margin, yPosition, statsImgWidth, statsImgHeight);
            document.body.removeChild(statsDiv);
        } catch (error) {
            console.error('Error capturing stats:', error);
            document.body.removeChild(statsDiv);
        }
        
        // 6. 월별 매출 현황 테이블 (tableContainer의 내용) - 이미지로 변환
        if (yPosition > pageHeight - 50) {
            pdf.addPage();
            yPosition = margin;
        }
        
        const tableElement = tableContainer.querySelector('.data-table');
        const salesTableSelectedYear = yearFilter.value;
        const selectedCategory = categoryFilter.value;
        
        if (tableElement) {
            // 테이블 제목 추가
            const salesTableTitleHTML = `
                <div style="font-family: 'Noto Sans KR', sans-serif; padding: 10px 0; background: white;">
                    <h2 style="font-size: 16px; font-weight: bold; margin: 0; color: #1e293b;">📊 ${salesTableSelectedYear}년 월별 매출 현황</h2>
                </div>
            `;
            
            const salesTableTitleDiv = document.createElement('div');
            salesTableTitleDiv.innerHTML = salesTableTitleHTML;
            salesTableTitleDiv.style.position = 'absolute';
            salesTableTitleDiv.style.left = '-9999px';
            salesTableTitleDiv.style.width = '180mm';
            document.body.appendChild(salesTableTitleDiv);
            
            try {
                const salesTableTitleImage = await html2canvas(salesTableTitleDiv, {
                    backgroundColor: '#ffffff',
                    scale: 2,
                    logging: false
                });
                
                const salesTableTitleImgData = salesTableTitleImage.toDataURL('image/png');
                const salesTableTitleImgWidth = pageWidth - (margin * 2);
                const salesTableTitleImgHeight = (salesTableTitleImage.height * salesTableTitleImgWidth) / salesTableTitleImage.width;
                
                if (yPosition + salesTableTitleImgHeight > pageHeight - margin) {
                    pdf.addPage();
                    yPosition = margin;
                }
                
                pdf.addImage(salesTableTitleImgData, 'PNG', margin, yPosition, salesTableTitleImgWidth, salesTableTitleImgHeight);
                yPosition += salesTableTitleImgHeight + 5;
                document.body.removeChild(salesTableTitleDiv);
            } catch (error) {
                document.body.removeChild(salesTableTitleDiv);
            }
            
            try {
                // 테이블을 이미지로 변환
                const tableImage = await html2canvas(tableElement, {
                    backgroundColor: '#ffffff',
                    scale: 2,
                    logging: false
                });
                
                const imgData = tableImage.toDataURL('image/png');
                const imgWidth = pageWidth - (margin * 2);
                const imgHeight = (tableImage.height * imgWidth) / tableImage.width;
                
                // 페이지 넘김 체크
                if (yPosition + imgHeight > pageHeight - margin) {
                    pdf.addPage();
                    yPosition = margin;
                }
                
                pdf.addImage(imgData, 'PNG', margin, yPosition, imgWidth, imgHeight);
                yPosition += imgHeight + 10;
            } catch (error) {
                console.error('Error capturing table:', error);
            }
        } else {
            // 테이블이 없으면 이미지로 데이터 표시
            const selectedYearData = getYearlyData(salesTableSelectedYear);
            let salesTableRows = '';
            
            for (let i = 0; i < 12; i++) {
                if (selectedYearData[i] > 0) {
                    salesTableRows += `
                        <tr style="border-bottom: 1px solid #e2e8f0;">
                            <td style="padding: 8px; text-align: left;">${i + 1}월</td>
                            <td style="padding: 8px; text-align: right;">${formatCurrency(selectedYearData[i])}</td>
                        </tr>
                    `;
                }
            }
            
            const salesTableHTML = `
                <div style="font-family: 'Noto Sans KR', sans-serif; padding: 20px; background: white;">
                    <h2 style="font-size: 16px; font-weight: bold; margin: 0 0 15px 0; color: #1e293b;">📊 ${salesTableSelectedYear}년 월별 매출 현황</h2>
                    <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                        <thead>
                            <tr style="background: #f8fafc; border-bottom: 2px solid #e2e8f0;">
                                <th style="padding: 10px; text-align: left; font-weight: 600; color: #475569;">월</th>
                                <th style="padding: 10px; text-align: right; font-weight: 600; color: #475569;">매출액</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${salesTableRows}
                        </tbody>
                    </table>
                </div>
            `;
            
            const salesTableDiv = document.createElement('div');
            salesTableDiv.innerHTML = salesTableHTML;
            salesTableDiv.style.position = 'absolute';
            salesTableDiv.style.left = '-9999px';
            salesTableDiv.style.width = '180mm';
            document.body.appendChild(salesTableDiv);
            
            try {
                const salesTableImage = await html2canvas(salesTableDiv, {
                    backgroundColor: '#ffffff',
                    scale: 2,
                    logging: false
                });
                
                const salesTableImgData = salesTableImage.toDataURL('image/png');
                const salesTableImgWidth = pageWidth - (margin * 2);
                const salesTableImgHeight = (salesTableImage.height * salesTableImgWidth) / salesTableImage.width;
                
                if (yPosition + salesTableImgHeight > pageHeight - margin) {
                    pdf.addPage();
                    yPosition = margin;
                }
                
                pdf.addImage(salesTableImgData, 'PNG', margin, yPosition, salesTableImgWidth, salesTableImgHeight);
                yPosition += salesTableImgHeight + 10;
                document.body.removeChild(salesTableDiv);
            } catch (error) {
                console.error('Error capturing sales table:', error);
                document.body.removeChild(salesTableDiv);
            }
        }
        
        // 파일명 생성
        const fileName = `${companyName}_${year2}-${year1}_매출비교_${new Date().toISOString().split('T')[0]}.pdf`;
        
        // PDF 저장
        pdf.save(fileName);
        
        pdfDownloadBtn.disabled = false;
        pdfDownloadBtn.textContent = '📄 PDF 다운로드';
        
    } catch (error) {
        console.error('Error generating PDF:', error);
        alert('PDF 생성 중 오류가 발생했습니다: ' + error.message);
        pdfDownloadBtn.disabled = false;
        pdfDownloadBtn.textContent = '📄 PDF 다운로드';
    }
}
