import React, { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { LoginPage, PasswordResetPage } from '../src/LoginPage';
import { LOGIN_INTRO_KEY, loginCopy, normalizeLoginLocale } from '../src/loginI18n';
import { completePasswordResetWithApi, requestPasswordResetWithApi } from '../src/authApi';

vi.mock('../src/authApi', () => ({ requestPasswordResetWithApi: vi.fn(), completePasswordResetWithApi: vi.fn() }));
const onLogin = vi.fn(async () => true);
function mount() { return render(<StrictMode><MemoryRouter><LoginPage session={null} redirectTo="/dashboard" onLogin={onLogin} /></MemoryRouter></StrictMode>); }
function browserLanguage(...languages: string[]) {
  vi.spyOn(navigator, 'languages', 'get').mockReturnValue(languages);
  vi.spyOn(navigator, 'language', 'get').mockReturnValue(languages[0]);
}
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); onLogin.mockClear();
  browserLanguage('pt-BR');
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })));
  vi.mocked(requestPasswordResetWithApi).mockResolvedValue({ ok: true, message: loginCopy.pt.recoverySuccess });
  vi.mocked(completePasswordResetWithApi).mockResolvedValue(undefined);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.clearAllMocks(); vi.useRealTimers(); });

describe('public login language and intro', () => {
  it.each([['it-IT','it'],['en-US','en'],['es-MX','es'],['sv-SE','sv'],['pt-PT','pt'],['de-DE','pt']] as const)('detects %s as %s', (tag, locale) => {
    browserLanguage(tag); mount(); expect(screen.getByRole('heading', { name: loginCopy[locale].welcome })).toBeTruthy();
    expect(document.querySelector('main')?.lang).toBe(locale);
    expect(screen.getByPlaceholderText(loginCopy[locale].passwordPlaceholder)).toBeTruthy();
  });
  it('honors the ordered browser language list and normalizes regional variants', () => {
    browserLanguage('de-DE','sv-SE','en-US'); mount(); expect(screen.getByRole('heading', { name: loginCopy.sv.welcome })).toBeTruthy();
    expect(normalizeLoginLocale('en-GB')).toBe('en'); expect(normalizeLoginLocale('pt-BR')).toBe('pt');
  });
  it('renders no selector and ignores the old manual preference on every public mount', () => {
    browserLanguage('it-IT'); localStorage.setItem('designhub-login-language','en');
    const view=mount(); expect(screen.getByRole('heading',{name:loginCopy.it.welcome})).toBeTruthy();
    expect(document.querySelector('.login-language-switcher')).toBeNull();
    expect(screen.queryByRole('button',{name:'English'})).toBeNull();
    view.unmount(); browserLanguage('sv-SE'); mount();
    expect(screen.getByRole('heading',{name:loginCopy.sv.welcome})).toBeTruthy();
    expect(localStorage.getItem('designhub-login-language')).toBeNull();
  });
  it('falls back to navigator.language when the list has no supported language', () => {
    browserLanguage('de-DE'); vi.spyOn(navigator,'language','get').mockReturnValue('es-ES'); mount();
    expect(screen.getByRole('heading',{name:loginCopy.es.welcome})).toBeTruthy();
  });
  it('keeps intro panels inert until the entrance ends, with a bounded fallback', async () => {
    vi.useFakeTimers(); mount(); expect(document.querySelectorAll('[inert]').length).toBe(2);
    await act(async()=>vi.advanceTimersByTime(1100)); expect(document.querySelectorAll('[inert]').length).toBe(2);
    await act(async()=>vi.advanceTimersByTime(800)); expect(document.querySelectorAll('[inert]').length).toBe(0);
    expect(document.querySelector('.login-intro-logo')).toBeNull();
  });
  it('releases the intro if reduced motion is enabled while it is playing', async () => {
    let listener!:()=>void; const motion={ matches:false, addEventListener:vi.fn((_event,cb)=>{listener=cb;}), removeEventListener:vi.fn() };
    vi.stubGlobal('matchMedia',vi.fn(()=>motion)); mount(); expect(document.querySelectorAll('[inert]').length).toBe(2);
    await act(async()=>{motion.matches=true;listener();}); expect(document.querySelectorAll('[inert]').length).toBe(0);
    expect(document.querySelector('.login-intro-logo')).toBeNull();
  });
  it('marks the intro once per session, including StrictMode, and skips remounts', () => {
    const view=mount(); expect(sessionStorage.getItem(LOGIN_INTRO_KEY)).toBe('1'); expect(document.querySelector('.login-intro')).toBeTruthy();
    view.unmount(); mount(); expect(document.querySelector('.login-intro')).toBeNull();
  });
  it('reduced motion skips the intro and leaves login fully usable', async () => {
    vi.stubGlobal('matchMedia',vi.fn(()=>({matches:true}))); mount(); expect(document.querySelector('.login-intro')).toBeNull();
    expect(sessionStorage.getItem(LOGIN_INTRO_KEY)).toBe('1');
    fireEvent.change(screen.getByLabelText('E-mail'),{target:{value:'reduced@example.test'}});
    fireEvent.change(screen.getByLabelText('Senha'),{target:{value:'safe-password'}});
    await act(async()=>fireEvent.submit(document.querySelector('#designhub-login')!));
    expect(onLogin).toHaveBeenCalledWith('reduced@example.test','safe-password');
  });
  it('storage restrictions do not prevent browser language detection or submitting', async () => {
    vi.spyOn(Storage.prototype,'getItem').mockImplementation(()=>{throw new Error('blocked');});
    vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('blocked');});
    browserLanguage('en-US'); mount();
    expect(screen.getByRole('heading',{name:loginCopy.en.welcome})).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Email'),{target:{value:'person@example.test'}});
    fireEvent.change(screen.getByLabelText('Password'),{target:{value:'safe-password'}});
    await act(async()=>fireEvent.submit(document.querySelector('#designhub-login')!));
    expect(onLogin).toHaveBeenCalledWith('person@example.test','safe-password');
  });
  it('preserves password manager attributes and exact login credentials', async () => {
    browserLanguage('it-IT'); mount();
    const username=screen.getByLabelText('Email'); const password=screen.getByLabelText('Password');
    expect(username.getAttribute('name')).toBe('username'); expect(username.getAttribute('autocomplete')).toBe('username');
    expect(password.getAttribute('name')).toBe('password'); expect(password.getAttribute('autocomplete')).toBe('current-password');
    fireEvent.change(username,{target:{value:'person@example.test'}}); fireEvent.change(password,{target:{value:' P@ss unchanged '}});
    let finish!: (value:boolean)=>void; onLogin.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
    fireEvent.submit(document.querySelector('#designhub-login')!);
    expect(screen.getByRole('button',{name:loginCopy.it.signingIn}).hasAttribute('disabled')).toBe(true);
    expect(onLogin).toHaveBeenCalledTimes(1); expect(onLogin).toHaveBeenCalledWith('person@example.test',' P@ss unchanged ');
    await act(async()=>finish(false)); expect(screen.getByText(loginCopy.it.loginError)).toBeTruthy();
  });
  it('recovery keeps the same API flow and translates its success message, with no calls on mount', async () => {
    browserLanguage('sv-SE'); mount(); expect(requestPasswordResetWithApi).not.toHaveBeenCalled(); expect(onLogin).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText(loginCopy.sv.email),{target:{value:'person@example.test'}});
    fireEvent.click(screen.getByRole('button',{name:loginCopy.sv.forgot}));
    expect(screen.getByRole('heading',{name:loginCopy.sv.recoveryTitle})).toBeTruthy(); expect(document.querySelector('[name=password]')).toBeNull();
    await act(async()=>fireEvent.submit(document.querySelector('#designhub-recovery')!));
    expect(requestPasswordResetWithApi).toHaveBeenCalledTimes(1); expect(requestPasswordResetWithApi).toHaveBeenCalledWith('person@example.test');
    expect(screen.getByRole('status').textContent).toBe(loginCopy.sv.recoverySuccess); expect(onLogin).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button',{name:loginCopy.sv.back})); expect(screen.getByLabelText(loginCopy.sv.password)).toBeTruthy();
  });
  it('translates known recovery errors and preserves unexpected API details', async () => {
    browserLanguage('en-US'); mount(); fireEvent.click(screen.getByRole('button',{name:loginCopy.en.forgot}));
    vi.mocked(requestPasswordResetWithApi).mockRejectedValueOnce(new Error(loginCopy.pt.recoveryUnavailable));
    await act(async()=>fireEvent.submit(document.querySelector('#designhub-recovery')!)); expect(screen.getByText(loginCopy.en.recoveryUnavailable)).toBeTruthy();
    vi.mocked(requestPasswordResetWithApi).mockRejectedValueOnce(new Error('Specific API detail'));
    await act(async()=>fireEvent.submit(document.querySelector('#designhub-recovery')!)); expect(screen.getByText('Specific API detail')).toBeTruthy();
  });
  it('completes password reset with unchanged token/password and existing login destination', async () => {
    browserLanguage('en-US'); render(<MemoryRouter initialEntries={['/reset-password?token=test-token']}><Routes><Route path="/reset-password" element={<PasswordResetPage/>}/><Route path="/login" element={<p>Login destination</p>}/></Routes></MemoryRouter>);
    expect(document.querySelector('.login-language-switcher')).toBeNull(); expect(document.querySelector('.login-intro')).toBeNull();
    fireEvent.change(screen.getByLabelText('New password'),{target:{value:'new-password'}}); fireEvent.change(screen.getByLabelText('Confirm new password'),{target:{value:'new-password'}});
    await act(async()=>fireEvent.submit(document.querySelector('form')!)); expect(completePasswordResetWithApi).toHaveBeenCalledWith('test-token','new-password');
    expect(screen.getByRole('heading',{name:loginCopy.en.resetSuccess})).toBeTruthy();
    fireEvent.click(screen.getByRole('button',{name:loginCopy.en.goLogin})); expect(screen.getByText('Login destination')).toBeTruthy();
  });
});
