import { LoginForm } from '../components/LoginForm';
import { ThemeToggle } from '@/shared/components/ui/ThemeToggle';

const CTUT_LOGO_SRC = '/assets/images/logo-truong-removebg-preview.png';
const LOGIN_BG_SRC = '/assets/images/login-bg-ctut.png';

export function LoginPage() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 min-h-screen w-full bg-[var(--app-bg)] transition-colors duration-250">
      {/* Brand plane — campus photo + school identity */}
      <div className="hidden lg:flex lg:col-span-7 xl:col-span-8 text-white flex-col justify-between p-10 xl:p-12 2xl:p-14 relative overflow-hidden min-h-screen">
        <div
          className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${LOGIN_BG_SRC})` }}
          aria-hidden
        />
        {/* Gradient đậm hơn phía dưới để chữ đọc rõ, tránh chồng biển tên trên nóc nhà */}
        <div
          className="absolute inset-0 z-0 bg-gradient-to-t from-slate-950/95 via-slate-950/45 to-slate-900/25"
          aria-hidden
        />

        {/* Chỉ logo + nhãn hệ thống ở trên */}
        <div className="z-10 flex items-center gap-3.5">
          <img
            src={CTUT_LOGO_SRC}
            alt="Logo CTUT"
            className="w-11 h-11 xl:w-12 xl:h-12 object-contain rounded-full bg-white p-1 shrink-0 shadow-sm"
          />
          <p className="text-[11px] font-medium tracking-wide text-blue-100/85">
            Hệ thống dịch vụ hành chính số
          </p>
        </div>

        {/* Khối chữ neo góc dưới trái — size vừa, không át ảnh trường */}
        <div className="z-10 max-w-xl">
          <h1 className="text-base xl:text-lg font-semibold text-white leading-snug tracking-tight">
            Trường Đại học Kỹ thuật — Công nghệ Cần Thơ
          </h1>
          <p className="mt-2 text-[13px] xl:text-sm text-slate-200/90 leading-relaxed">
            Cổng quản trị thủ tục hành chính điện tử cho cán bộ và quản trị viên.
          </p>
          <div className="mt-6 pt-4 border-t border-white/15 flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-slate-300/85 font-medium">
            <span>ISO/IEC 27001</span>
            <span>NĐ 130/2018/NĐ-CP — Chữ ký số</span>
          </div>
        </div>
      </div>

      <div className="col-span-1 lg:col-span-5 xl:col-span-4 flex items-center justify-center p-5 sm:p-8 bg-[var(--app-surface)] relative transition-colors duration-250 min-h-screen">
        <div className="absolute top-4 right-4 z-20">
          <ThemeToggle />
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
