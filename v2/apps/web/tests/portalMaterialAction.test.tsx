import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ExternalMaterialAction } from '../src/ExternalMaterialAction';

afterEach(cleanup);
describe('external material action', () => {
  for (const [locale, video, generic, hint] of [
    ['pt-BR', 'Assistir ao vídeo', 'Abrir material', 'Abre em uma nova aba'],
    ['it-IT', 'Guarda il video', 'Apri materiale', 'Si apre in una nuova scheda'],
    ['en', 'Watch video', 'Open material', 'Opens in a new tab'],
    ['es', 'Ver el vídeo', 'Abrir material', 'Se abre en una pestaña nueva'],
    ['sv', 'Se videon', 'Öppna material', 'Öppnas i en ny flik'],
  ]) it(`localizes both types and the new-tab hint: ${locale}`, () => {
    const { rerender } = render(<ExternalMaterialAction url="https://cdn.example.test/review.MP4?token=one#start" locale={locale} />);
    const link = screen.getByRole('link', { name: new RegExp(video) });
    expect(link.getAttribute('href')).toBe('https://cdn.example.test/review.MP4?token=one#start');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    expect(link.textContent).toContain(hint);
    expect(link.querySelectorAll('[aria-hidden="true"]').length).toBe(2);
    rerender(<ExternalMaterialAction url="https://drive.google.com/file/d/synthetic/view" locale={locale} />);
    expect(screen.getByRole('link', { name: new RegExp(generic) })).toBeTruthy();
    expect(screen.queryByText(video)).toBeNull();
  });
  for (const url of [
    'https://youtu.be/abcdefghijk', 'https://www.youtube.com/watch?v=abcdefghijk',
    'https://youtube.com/shorts/abcdefghijk', 'https://vimeo.com/1234567',
    'https://cdn.example.test/review.webm?download=1',
  ]) it(`recognizes an explicit video URL: ${url}`, () => {
    render(<ExternalMaterialAction url={url} locale="it" />);
    expect(screen.getByText('Guarda il video')).toBeTruthy();
  });
  for (const url of [
    'https://drive.google.com/file/d/synthetic.mp4', 'https://docs.google.com/document/d/synthetic/edit', 'https://drive.google.com/file/d/synthetic/view',
    'https://youtube.com/playlist?list=synthetic', 'https://youtube.com.evil.test/watch?v=abcdefghijk',
    'https://example.test/?filename=video.mp4', 'https://example.test/#video.mp4',
    'https://example.test/reel', 'https://vimeo.com/features',
  ]) it(`does not infer video from an ambiguous URL: ${url}`, () => {
    render(<ExternalMaterialAction url={url} locale="pt" />);
    expect(screen.getByText('Abrir material')).toBeTruthy();
  });
  for (const url of [null, '', 'javascript:alert(1)', 'data:text/html,<h1>x</h1>', 'file:///tmp/video.mp4', '/relative', '//example.test', 'https://', 'https://user:password@example.test']) {
    it(`does not expose an unsafe or invalid URL: ${url}`, () => {
      render(<ExternalMaterialAction url={url} locale="pt" />);
      expect(screen.queryByRole('link')).toBeNull();
    });
  }
});
