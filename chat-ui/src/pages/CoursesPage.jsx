import { useNavigate } from 'react-router-dom';
import ThemeToggle from '../components/ThemeToggle';
import coursesData from '../data/coursesData';
import './CoursesPage.css';

export default function CoursesPage() {
  const navigate = useNavigate();

  return (
    <div className="courses-page">
      {/* Background */}
      <div className="courses-bg">
        <div className="courses-gradient" />
      </div>

      <nav className="courses-nav">
        <button className="nav-back" onClick={() => navigate('/')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
          <span>العودة للرئيسية</span>
        </button>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <ThemeToggle />
          <div className="nav-brand-sm">
            <span className="nav-logo-sm">بـ</span>
            <span>بحر المعرفة</span>
          </div>
        </div>
      </nav>

      {/* Header */}
      <header className="courses-header">
        <h1>الدورات التعليمية</h1>
        <p>اختر الدورة التي تريد دراستها وابدأ رحلتك في عالم اللوجستيات البحرية</p>
      </header>

      {/* Cards Grid */}
      <div className="courses-grid">
        {coursesData.map((course, index) => (
          <div
            key={course.id}
            className="course-card"
            style={{
              '--accent': course.color,
              '--delay': `${index * 0.08}s`,
            }}
            onClick={() => navigate(`/courses/${course.id}`)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && navigate(`/courses/${course.id}`)}
          >
            <div className="card-glow" />
            <div className="card-image">
              <img src={course.image} alt={course.title} />
              <div className="card-number">{String(index + 1).padStart(2, '0')}</div>
            </div>
            <div className="card-content-wrapper">
              <h3 className="card-title">{course.title}</h3>
            <p className="card-desc">{course.description}</p>
            <div className="card-footer">
              <span className="card-sections">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                4 أقسام
              </span>
              <span className="card-arrow">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </span>
            </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
