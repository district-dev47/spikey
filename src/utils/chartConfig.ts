import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend
} from 'chart.js';

// Register Chart.js components
ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend
);

export const chartOptions = {
    responsive: true,
    plugins: {
        legend: {
            display: false,
        },
        title: {
            display: true,
            text: 'Recent Attendance Trend',
        },
    },
    scales: {
        y: {
            beginAtZero: true,
            max: 100,
            ticks: {
                callback: (value: number) => `${value}%`
            }
        }
    }
}; 