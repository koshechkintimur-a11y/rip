import { z } from 'zod';

export const signupSchema = z.object({
  email: z.string().email('Некорректный email'),
  password: z.string().min(6, 'Минимум 6 символов'),
  username: z
    .string()
    .min(3, 'Минимум 3 символа')
    .max(20, 'Максимум 20 символов')
    .regex(/^[a-z0-9_]+$/, 'Только a-z, 0-9 и _'),
});

export const loginSchema = z.object({
  email: z.string().email('Некорректный email'),
  password: z.string().min(1, 'Введите пароль'),
});

export const messageSchema = z.object({
  content: z.string().trim().max(500, 'Максимум 500 символов'),
  mediaUrl: z.string().url().optional().nullable(),
  mediaType: z.enum(['image', 'gif']).optional().nullable(),
  parentMessageId: z.string().uuid().optional().nullable(),
}).refine((v) => v.content.length > 0 || !!v.mediaUrl, {
  message: 'Пустое сообщение',
});

export const dmSchema = z.object({
  conversationId: z.string().uuid().optional().nullable(),
  recipientId: z.string().uuid().optional().nullable(),
  content: z.string().trim().min(1, 'Пустое сообщение').max(1000),
  mediaUrl: z.string().optional().nullable(),
  mediaType: z.enum(['image', 'gif']).optional().nullable(),
});

export const attentionSchema = z.object({
  content: z.string().trim().min(1, 'Что кричим?').max(80, 'Максимум 80 символов'),
  slots: z.number().int().min(1).max(5),
  minutes: z.number().int().min(10).max(120),
  mediaUrl: z.string().optional().nullable(),
  mediaType: z.enum(['image', 'gif']).optional().nullable(),
});

export const profileSchema = z.object({
  displayName: z.string().trim().max(40).optional(),
  bio: z.string().trim().max(200).optional(),
});

/** Простейший фильтр мата (расширяемо) */
const BANNED = ['блять', 'сука', 'хуй', 'пизд', 'еба', 'еблан', 'мразь', 'fuck', 'shit'];
export function containsProfanity(text: string): boolean {
  const t = text.toLowerCase();
  return BANNED.some((w) => t.includes(w));
}
