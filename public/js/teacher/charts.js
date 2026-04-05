let leaderboardChart = null;
let masteryChart = null;

export function renderLeaderboardChart(data) {
  const canvas = document.getElementById('leaderboard-chart');
  if (leaderboardChart) leaderboardChart.destroy();

  leaderboardChart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: data.map(d => d.display_name),
      datasets: [{ label: 'XP', data: data.map(d => d.xp), backgroundColor: '#e94560' }],
    },
    options: {
      responsive: true,
      plugins: { legend: { labels: { color: '#eee' } } },
      scales: {
        x: { ticks: { color: '#eee' } },
        y: { ticks: { color: '#eee' }, beginAtZero: true },
      },
    },
  });
}

export function renderMasteryChart(data) {
  const canvas = document.getElementById('mastery-chart');
  if (masteryChart) masteryChart.destroy();
  if (!data || data.length === 0) return;

  masteryChart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: data.map(d => d.subtopic_name),
      datasets: [{
        label: 'Average Mastery %',
        data: data.map(d => d.avg_mastery),
        backgroundColor: data.map(d => d.avg_mastery < 50 ? '#e94560' : '#40916c'),
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      plugins: { legend: { labels: { color: '#eee' } } },
      scales: {
        x: { ticks: { color: '#eee' }, max: 100, beginAtZero: true },
        y: { ticks: { color: '#eee', font: { size: 10 } } },
      },
    },
  });
}
