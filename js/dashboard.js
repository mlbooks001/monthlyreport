// DOM Elements (DOMContentLoaded 이후에 초기화)
let userEmailEl, companyNameEl, logoutBtn, tableContainer, yearFilter, categoryFilter;
let compareYear1, compareYear2, compareBtn;

// Stats Elements
let currentMonthSalesEl, lastMonthSalesEl, yearTotalSalesEl, avgMonthlySalesEl, salesChangeEl;

// Insight Elements
let selectedYearsEl, growthTitleEl, growthDescriptionEl, peakTitleEl, peakDescriptionEl, peakMonthEl, insightsContentEl;

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
    insightsContentEl = document.getElementById('insightsContent');
    
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
    
    // 상세 인사이트 생성
    generateDetailedInsights(year1, year2, data1, data2);
}

// 상세 인사이트 생성
function generateDetailedInsights(year1, year2, data1, data2) {
    const insights = [];
    
    const total1 = data1.reduce((a, b) => a + b, 0);
    const total2 = data2.reduce((a, b) => a + b, 0);
    
    // 데이터가 없는 경우
    if (total1 === 0 && total2 === 0) {
        insightsContentEl.innerHTML = `
            <div class="empty-state">
                <h4>📊 분석할 데이터가 없습니다</h4>
                <p>매출 데이터가 등록되면 자동으로 인사이트가 생성됩니다.</p>
            </div>
        `;
        return;
    }
    
    // 1. 연간 성장률
    if (total2 > 0) {
        const growthRate = ((total1 - total2) / total2 * 100).toFixed(1);
        insights.push({
            icon: growthRate >= 0 ? '📈' : '📉',
            iconClass: growthRate >= 0 ? 'up' : 'down',
            title: '연간 매출 성장률',
            description: `${year1}년 매출은 전년 대비 <span class="${growthRate >= 0 ? 'highlight-positive' : 'highlight-negative'}">${growthRate >= 0 ? '+' : ''}${growthRate}%</span> ${growthRate >= 0 ? '성장' : '감소'}했습니다.`
        });
    }
    
    // 2. 최고/최저 매출 월
    const positiveData1 = data1.filter(v => v > 0);
    if (positiveData1.length > 0) {
        const max1 = Math.max(...positiveData1);
        const min1 = Math.min(...positiveData1);
        const maxMonth1 = data1.indexOf(max1) + 1;
        const minMonth1 = data1.indexOf(min1) + 1;
        
        insights.push({
            icon: '🏆',
            iconClass: 'star',
            title: `${year1}년 최고 매출 월`,
            description: `<span class="highlight-value">${maxMonth1}월</span>에 <span class="highlight-positive">${formatCurrency(max1)}</span>로 가장 높은 매출을 기록했습니다.`
        });
        
        if (min1 !== max1) {
            insights.push({
                icon: '📍',
                iconClass: 'info',
                title: `${year1}년 최저 매출 월`,
                description: `<span class="highlight-value">${minMonth1}월</span>에 <span class="highlight-negative">${formatCurrency(min1)}</span>로 가장 낮은 매출을 기록했습니다.`
            });
        }
    }
    
    // 3. 상반기 vs 하반기 비교
    const firstHalf1 = data1.slice(0, 6).reduce((a, b) => a + b, 0);
    const secondHalf1 = data1.slice(6, 12).reduce((a, b) => a + b, 0);
    
    if (firstHalf1 > 0 || secondHalf1 > 0) {
        const halfDiff = secondHalf1 - firstHalf1;
        const halfPercent = firstHalf1 > 0 ? ((halfDiff / firstHalf1) * 100).toFixed(1) : 0;
        
        insights.push({
            icon: '📊',
            iconClass: 'info',
            title: '상반기 vs 하반기',
            description: `${year1}년 상반기 ${formatCompactCurrency(firstHalf1)}, 하반기 ${formatCompactCurrency(secondHalf1)}로 하반기가 <span class="${halfDiff >= 0 ? 'highlight-positive' : 'highlight-negative'}">${halfDiff >= 0 ? '+' : ''}${halfPercent}%</span> ${halfDiff >= 0 ? '더 높습니다.' : '더 낮습니다.'}`
        });
    }
    
    // 4. 월평균 매출
    const monthsWithData1 = data1.filter(v => v > 0).length;
    if (monthsWithData1 > 0) {
        const avgMonthly1 = total1 / monthsWithData1;
        insights.push({
            icon: '💰',
            iconClass: 'info',
            title: '월평균 매출',
            description: `${year1}년 월평균 매출은 <span class="highlight-value">${formatCurrency(avgMonthly1)}</span>입니다. (데이터가 있는 ${monthsWithData1}개월 기준)`
        });
    }
    
    // 5. 연속 성장/하락 구간
    let consecutiveGrowth = findConsecutiveTrend(data1);
    if (consecutiveGrowth.length > 0 && consecutiveGrowth.months > 2) {
        insights.push({
            icon: consecutiveGrowth.type === 'growth' ? '🚀' : '⚠️',
            iconClass: consecutiveGrowth.type === 'growth' ? 'up' : 'down',
            title: `연속 ${consecutiveGrowth.type === 'growth' ? '성장' : '하락'} 구간`,
            description: `${consecutiveGrowth.startMonth}월부터 ${consecutiveGrowth.endMonth}월까지 <span class="${consecutiveGrowth.type === 'growth' ? 'highlight-positive' : 'highlight-negative'}">${consecutiveGrowth.months}개월 연속 ${consecutiveGrowth.type === 'growth' ? '성장' : '하락'}</span>했습니다.`
        });
    }
    
    // 인사이트 HTML 생성
    if (insights.length > 0) {
        insightsContentEl.innerHTML = insights.map(insight => `
            <div class="insight-item">
                <div class="insight-item-icon ${insight.iconClass}">${insight.icon}</div>
                <div class="insight-item-content">
                    <h4>${insight.title}</h4>
                    <p>${insight.description}</p>
                </div>
            </div>
        `).join('');
    }
}

// 연속 추세 찾기
function findConsecutiveTrend(data) {
    let maxStreak = { type: '', months: 0, startMonth: 0, endMonth: 0 };
    let currentStreak = { type: '', months: 1, startMonth: 1 };
    
    for (let i = 1; i < data.length; i++) {
        if (data[i] > 0 && data[i - 1] > 0) {
            const trend = data[i] > data[i - 1] ? 'growth' : 'decline';
            
            if (trend === currentStreak.type) {
                currentStreak.months++;
            } else {
                if (currentStreak.months > maxStreak.months) {
                    maxStreak = { ...currentStreak, endMonth: i };
                }
                currentStreak = { type: trend, months: 1, startMonth: i };
            }
        }
    }
    
    if (currentStreak.months > maxStreak.months) {
        maxStreak = { ...currentStreak, endMonth: data.length };
    }
    
    return maxStreak;
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
