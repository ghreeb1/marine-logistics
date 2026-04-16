import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ThemeToggle from '../components/ThemeToggle';
import './LandingPage.css';

export default function LandingPage() {
  const navigate = useNavigate();
  const [showAbout, setShowAbout] = useState(false);

  const features = [
    {
      title: 'مساعد ذكي بالذكاء الاصطناعي',
      desc: 'احصل على إجابات فورية ودقيقة لجميع استفساراتك في مجال اللوجستيات البحرية',
    },
    {
      title: 'محتوى تعليمي شامل',
      desc: 'ثمانية دورات متكاملة تغطي جميع جوانب النقل البحري من الأساسيات إلى المتقدم',
    },
    {
      title: 'اختبارات وأنشطة تفاعلية',
      desc: 'عزّز فهمك من خلال أنشطة عملية واختبارات تقييمية في نهاية كل دورة',
    },
  ];

  const stats = [
    { value: '8', label: 'دورات تعليمية' },
    { value: '40+', label: 'اختبار تفاعلي' },
    { value: '∞', label: 'أسئلة للمساعد الذكي' },
  ];

  return (
    <div className="landing">
      {/* Animated Background */}
      <div className="landing-bg">
        <div className="wave wave-1" />
        <div className="wave wave-2" />
        <div className="wave wave-3" />
        <div className="particles">
          {[...Array(20)].map((_, i) => (
            <div key={i} className="particle" style={{
              '--x': `${Math.random() * 100}%`,
              '--y': `${Math.random() * 100}%`,
              '--duration': `${3 + Math.random() * 4}s`,
              '--delay': `${Math.random() * 3}s`,
              '--size': `${2 + Math.random() * 4}px`,
            }} />
          ))}
        </div>
      </div>

      <nav className="landing-nav relative z-50">
        <div className="nav-brand cursor-pointer" onClick={() => navigate('/')}>
          <span className="nav-logo">بـ</span>
          <span className="nav-title">بحر المعرفة</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <button className="about-nav-btn" onClick={() => setShowAbout(true)} aria-label="نبذه عن الموقع">
            <span className="about-text">نبذه عن الموقع</span>
            <svg className="about-icon-svg" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="16" x2="12" y2="12"></line>
              <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>
          </button>
          <ThemeToggle />
        </div>
      </nav>

      {/* About Modal */}
      {showAbout && (
        <div className="about-modal-overlay" onClick={() => setShowAbout(false)}>
          <div className="about-modal-content" onClick={e => e.stopPropagation()}>
            <button className="close-modal-btn" onClick={() => setShowAbout(false)} aria-label="إغلاق">✕</button>

            <div className="modal-header">
              <h2 className="modal-title">بحر المعرفة</h2>
              <p className="modal-subtitle">منصة بحرية في سلاسل الامداد البحرية</p>
            </div>

            <div className="modal-section">
              <h3>ماذا تقدم المنصة؟</h3>
              <p>منصة متكاملة تهدف إلى رفع مستوى الوعي والتأهيل المهنـي في النقل البحري وسلاسل الإمداد. نقدم محتوى تفاعلي يشمل دورات متخصصة، واختبارات قياس ذكية، ومكتبة غنية بالمعلومات التي صُممت بعناية لتناسب كافة الفئات المهتمة بهذا القطاع الحيوي المؤثر عالمياً، مما يساهم في الارتقاء بالكوادر الوطنية وتبادل الخبرات.</p>
            </div>

            <div className="modal-section">
              <h3>المساعد اللوجيستي الذكي</h3>
              <p>أداة تقنية متطورة تعتمد على نماذج الذكاء الاصطناعي لفهم التخصصات البحرية واللوجستية. يتميز المساعد بـ <strong>الاسترجاع الدقيق للمعلومات</strong> من المناهج المعتمدة، و<strong>تبسيط المفاهيم المعقدة</strong>، وتقديم <strong>حلول منهجية</strong> للتحديات الميدانية. يوفر المساعد استشارات حية ومباشرة بأداء فائق وسرعة لا تضاهى لتكون دليلك الذكي على مدار الساعة.</p>
            </div>

            <div className="modal-section developer-section">
              <div className="developer-badge">المطوّر</div>
              <h3 className="developer-name">سالم م. السويداء</h3>

              <div className="developer-contact">
                <p className="contact-label">نسعد بتواصلكم من خلال الموارد التالية:</p>
                <div className="contact-links">
                  <a href="tel:+966594960096" dir="ltr" className="contact-link phone-link">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                    +966 594960096
                  </a>
                  <a href="mailto:smsalsuwaida@gmail.com" className="contact-link email-link">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                    smsalsuwaida@gmail.com
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hero Section */}
      <section className="hero">
        <div className="max-w-5xl mx-auto relative z-10 px-6 flex flex-col items-center">
          <div className="hero-content !mx-0 !max-w-none text-center flex flex-col items-center">
            <div className="hero-badge">
              <span className="badge-dot" />
              <span>منصة بحرية في سلاسل الامداد البحرية</span>
            </div>
            <h1 className="hero-title">
              <span className="gradient-text">بحر المعرفة</span>
              <br />
              <span className="hero-subtitle-text">بوابتك لعالم اللوجستيات البحرية</span>
            </h1>
            <p className="hero-description text-center max-w-3xl mx-auto">
              منصة تعليمية ذكية تجمع بين قوة الذكاء الاصطناعي والمحتوى التعليمي المتخصص لتأخذك في رحلة معرفية شاملة في عالم النقل البحري وسلاسل الإمداد
            </p>

            <div className="hero-buttons w-full max-w-lg mx-auto flex flex-col gap-4">
              <button
                className="btn btn-primary justify-center text-center"
                onClick={() => navigate('/chat')}
                id="btn-chatbot"
              >
                <span className="btn-content w-full items-center">
                  <span className="btn-label">مساعدك الذكي للوجستيات البحرية</span>
                  <span className="btn-sublabel">اسأل أي سؤال واحصل على إجابة فورية</span>
                </span>
                <span className="btn-arrow absolute left-6">←</span>
              </button>
              <button
                className="btn btn-secondary justify-center text-center"
                onClick={() => navigate('/courses')}
                id="btn-courses"
              >
                <span className="btn-content w-full items-center">
                  <span className="btn-label">ابدأ رحلتك التعليمية</span>
                  <span className="btn-sublabel">8 دورات متكاملة مع اختبارات تفاعلية</span>
                </span>
                <span className="btn-arrow absolute left-6">←</span>
              </button>
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="stats-row">
          {stats.map((stat, i) => (
            <div key={i} className="stat-card">
              <span className="stat-value">{stat.value}</span>
              <span className="stat-label">{stat.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Real World Info Section */}
      <section className="info-section">
        <div className="info-content">
          <div className="info-text">
            <h2 className="section-title">عصب التجارة والاقتصاد العالمي</h2>
            <p>
              يعد النقل البحري العمود الفقري للتجارة الدولية والاقتصاد العالمي. بفضل كفاءته وانخفاض تكلفته مقارنة بوسائل النقل الأخرى، يتم نقل حوالي <strong>80% من حجم بضائع التجارة العالمية</strong> بحراً، وهو ما يعكس الأهمية الاستراتيجية القصوى للأسطول والموانئ.
            </p>
            <p>
              وفقاً لأحدث البيانات، بلغ حجم البضائع المنقولة بحراً في عام 2024 أكثر من <strong>12.7 مليار طن</strong>، لتغطي مسافات شاسعة وتدعم سلاسل الإمداد العالمية. يمر القطاع حالياً بتحول رقمي وتقني واسع لدعم الاستدامة البيئية وخفض الانبعاثات الكربونية.
            </p>
          </div>
          <div className="info-images">
            <img src="/hero-ship.png" alt="سفينة حاويات في البحر" className="info-img img-main" />
            <img src="/cargo-port.png" alt="محطة موانئ حاويات حديثة" className="info-img img-secondary" />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features-section">
        <h2 className="section-title">ماذا نقدم لك؟</h2>
        <div className="features-grid">
          {features.map((f, i) => (
            <div key={i} className="feature-card" style={{ '--delay': `${i * 0.1}s` }}>
              <div className="feature-number">{String(i + 1).padStart(2, '0')}</div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="footer-content">
          <span className="footer-brand">بحر المعرفة</span>
          <span className="footer-copy">منصة تعليمية في اللوجستيات البحرية — {new Date().getFullYear()}</span>
        </div>
      </footer>
    </div>
  );
}
