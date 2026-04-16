const getApiBaseUrl = () => {
    if (import.meta.env && import.meta.env.PROD) return '';
    return (import.meta.env && import.meta.env.VITE_API_BASE_URL) || 'http://localhost:8000';
};

const GATEWAY_URL = `${getApiBaseUrl()}/api`;

const defaultHeaders = {
    'ngrok-skip-browser-warning': 'true'
};

export const fetchCourses = async () => {
    const res = await fetch(`${GATEWAY_URL}/content/courses`, { headers: defaultHeaders });
    if (!res.ok) throw new Error('Failed to fetch courses');
    return res.json();
};

export const fetchCourseIntro = async (id) => {
    const res = await fetch(`${GATEWAY_URL}/content/courses/${id}/intro`, { headers: defaultHeaders });
    if (!res.ok) throw new Error('Failed to fetch introduction');
    return res.json();
};

export const fetchCourseContent = async (id) => {
    const res = await fetch(`${GATEWAY_URL}/content/courses/${id}/content`, { headers: defaultHeaders });
    if (!res.ok) throw new Error('Failed to fetch content');
    return res.json();
};

export const fetchCourseActivities = async (id) => {
    const res = await fetch(`${GATEWAY_URL}/content/courses/${id}/activities`, { headers: defaultHeaders });
    if (!res.ok) throw new Error('Failed to fetch activities');
    return res.json();
};

export const fetchCourseQuiz = async (id) => {
    const res = await fetch(`${GATEWAY_URL}/quiz/courses/${id}/quiz`, { headers: defaultHeaders });
    if (!res.ok) throw new Error('Failed to fetch quiz');
    return res.json();
};

export const submitCourseQuiz = async (id, answers) => {
    const res = await fetch(`${GATEWAY_URL}/quiz/courses/${id}/quiz/score`, {
        method: 'POST',
        headers: {
            ...defaultHeaders,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ answers })
    });
    if (!res.ok) throw new Error('Failed to submit quiz');
    return res.json();
};
