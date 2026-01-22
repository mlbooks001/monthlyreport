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
    // DOM 요소 초기화
    initDOMElements();
    
    // 이벤트 리스너 설정
    setupEventListeners();
    
    await checkAuth();
    await loadAllSalesData();
    await loadSalesData();
    initChart();
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
    const { data: { session } } = await supabaseClient.auth.getSession();
    
    if (!session) {
        window.location.href = 'index.html';
        return;
    }
    
    currentUser = session.user;
    userEmailEl.textContent = currentUser.email;
    companyNameEl.textContent = currentUser.user_metadata?.company_name || '고객';
}

// 모든 연도의 매출 데이터 로드
async function loadAllSalesData() {
    try {
        const { data: salesData, error } = await supabaseClient
            .from('sales_reports')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('year', { ascending: true })
            .order('month', { ascending: true });
        
        if (error) throw error;
        
        // 연도별로 데이터 정리
        allSalesData = {};
        const categories = new Set();
        
        if (salesData) {
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
        updateCategoryFilter(Array.from(categories));
        
    } catch (error) {
        console.error('Error loading all sales data:', error);
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
    const selectedYear = yearFilter.value;
    const selectedCategory = categoryFilter.value;
    
    tableContainer.innerHTML = `
        <div class="loading">
            <div class="spinner"></div>
        </div>
    `;
    
    try {
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
        
        if (error) throw error;
        
        displaySalesData(salesData, selectedYear, selectedCategory);
        updateStats(salesData);
        
    } catch (error) {
        console.error('Error loading sales data:', error);
        displayEmptyState();
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
        // 1. 헤더 정보
        pdf.setFontSize(18);
        pdf.setFont('helvetica', 'bold');
        const companyName = companyNameEl.textContent || '고객';
        const year1 = compareYear1.value;
        const year2 = compareYear2.value;
        pdf.text(`${companyName} ${year2}-${year1} 매출 비교 리포트`, pageWidth / 2, yPosition, { align: 'center' });
        yPosition += 10;
        
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        const currentDate = new Date().toLocaleDateString('ko-KR');
        pdf.text(`생성일: ${currentDate}`, pageWidth / 2, yPosition, { align: 'center' });
        yPosition += 15;
        
        // 2. 요약 정보 카드
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'bold');
        pdf.text('📊 요약 정보', margin, yPosition);
        yPosition += 8;
        
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        const data1 = getYearlyData(year1);
        const data2 = getYearlyData(year2);
        const total1 = data1.reduce((a, b) => a + b, 0);
        const total2 = data2.reduce((a, b) => a + b, 0);
        const growthRate = total2 > 0 ? ((total1 - total2) / total2 * 100).toFixed(1) : 0;
        
        pdf.text(`• ${year1}년 총 매출: ${formatCurrency(total1)}`, margin + 5, yPosition);
        yPosition += 6;
        pdf.text(`• ${year2}년 총 매출: ${formatCurrency(total2)}`, margin + 5, yPosition);
        yPosition += 6;
        pdf.text(`• 전년 대비: ${growthRate >= 0 ? '+' : ''}${growthRate}% ${growthRate >= 0 ? '성장' : '감소'}`, margin + 5, yPosition);
        yPosition += 10;
        
        // 3. 차트 이미지 추가
        const chartCanvas = document.getElementById('salesChart');
        if (chartCanvas) {
            pdf.setFontSize(12);
            pdf.setFont('helvetica', 'bold');
            pdf.text('📈 월별 매출 비교 차트', margin, yPosition);
            yPosition += 5;
            
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
                pdf.text('차트 이미지를 생성할 수 없습니다.', margin, yPosition);
                yPosition += 10;
            }
        }
        
        // 4. 월별 매출 데이터 테이블
        if (yPosition > pageHeight - 50) {
            pdf.addPage();
            yPosition = margin;
        }
        
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'bold');
        pdf.text('📋 월별 매출 상세', margin, yPosition);
        yPosition += 8;
        
        // 테이블 헤더
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'bold');
        const colWidths = [20, 30, 30, 30, 30];
        const headers = ['월', `${year1}년`, `${year2}년`, '차이', '증감률'];
        let xPos = margin;
        
        headers.forEach((header, i) => {
            pdf.text(header, xPos, yPosition);
            xPos += colWidths[i];
        });
        yPosition += 6;
        
        // 테이블 데이터
        pdf.setFont('helvetica', 'normal');
        const months = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
        
        for (let i = 0; i < 12; i++) {
            if (yPosition > pageHeight - 15) {
                pdf.addPage();
                yPosition = margin;
            }
            
            const month1 = data1[i] || 0;
            const month2 = data2[i] || 0;
            const diff = month1 - month2;
            const changeRate = month2 > 0 ? ((diff / month2) * 100).toFixed(1) : (month1 > 0 ? '100.0' : '0.0');
            
            xPos = margin;
            pdf.text(months[i], xPos, yPosition);
            xPos += colWidths[0];
            pdf.text(formatCurrency(month1), xPos, yPosition);
            xPos += colWidths[1];
            pdf.text(formatCurrency(month2), xPos, yPosition);
            xPos += colWidths[2];
            pdf.text(formatCurrency(diff), xPos, yPosition);
            xPos += colWidths[3];
            pdf.text(`${changeRate >= 0 ? '+' : ''}${changeRate}%`, xPos, yPosition);
            
            yPosition += 6;
        }
        
        // 5. 통계 카드 정보
        if (yPosition > pageHeight - 40) {
            pdf.addPage();
            yPosition = margin;
        }
        
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'bold');
        pdf.text('💰 주요 통계', margin, yPosition);
        yPosition += 8;
        
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        const currentMonth = new Date().getMonth() + 1;
        const currentYear = new Date().getFullYear();
        const selectedYear = parseInt(yearFilter.value);
        
        let currentMonthSales = 0;
        let lastMonthSales = 0;
        
        if (selectedYear === currentYear) {
            currentMonthSales = data1[currentMonth - 1] || 0;
            lastMonthSales = data1[currentMonth - 2] || 0;
        } else {
            currentMonthSales = data1[11] || 0;
            lastMonthSales = data1[10] || 0;
        }
        
        pdf.text(`• 이번 달 매출: ${formatCurrency(currentMonthSales)}`, margin + 5, yPosition);
        yPosition += 6;
        pdf.text(`• 지난 달 매출: ${formatCurrency(lastMonthSales)}`, margin + 5, yPosition);
        yPosition += 6;
        pdf.text(`• 올해 누적 매출: ${formatCurrency(total1)}`, margin + 5, yPosition);
        yPosition += 6;
        
        const monthsWithData = data1.filter(v => v > 0).length;
        const avgSales = monthsWithData > 0 ? total1 / monthsWithData : 0;
        pdf.text(`• 평균 월 매출: ${formatCurrency(avgSales)}`, margin + 5, yPosition);
        yPosition += 15;
        
        // 6. 월별 매출 현황 테이블 (tableContainer의 내용)
        const tableElement = tableContainer.querySelector('.data-table');
        if (tableElement) {
            if (yPosition > pageHeight - 50) {
                pdf.addPage();
                yPosition = margin;
            }
            
            pdf.setFontSize(12);
            pdf.setFont('helvetica', 'bold');
            const selectedYear = yearFilter.value;
            const selectedCategory = categoryFilter.value;
            pdf.text(`📊 ${selectedYear}년 월별 매출 현황`, margin, yPosition);
            yPosition += 8;
            
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
                // 이미지 변환 실패 시 텍스트로 표시
                pdf.setFontSize(10);
                pdf.setFont('helvetica', 'normal');
                pdf.text('월별 매출 현황 테이블을 포함할 수 없습니다.', margin, yPosition);
                yPosition += 10;
            }
        } else {
            // 테이블이 없으면 텍스트로 데이터 표시
            if (yPosition > pageHeight - 50) {
                pdf.addPage();
                yPosition = margin;
            }
            
            pdf.setFontSize(12);
            pdf.setFont('helvetica', 'bold');
            const selectedYear = yearFilter.value;
            pdf.text(`📊 ${selectedYear}년 월별 매출 현황`, margin, yPosition);
            yPosition += 8;
            
            // 현재 선택된 연도의 데이터 가져오기
            const selectedYearData = getYearlyData(selectedYear);
            pdf.setFontSize(9);
            pdf.setFont('helvetica', 'bold');
            pdf.text('월', margin, yPosition);
            pdf.text('매출액', margin + 50, yPosition);
            yPosition += 6;
            
            pdf.setFont('helvetica', 'normal');
            for (let i = 0; i < 12; i++) {
                if (yPosition > pageHeight - 15) {
                    pdf.addPage();
                    yPosition = margin;
                }
                
                if (selectedYearData[i] > 0) {
                    pdf.text(`${i + 1}월`, margin, yPosition);
                    pdf.text(formatCurrency(selectedYearData[i]), margin + 50, yPosition);
                    yPosition += 6;
                }
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
