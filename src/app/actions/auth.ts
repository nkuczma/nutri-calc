'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function signIn() {
  const supabase = await createClient()
  const headersList = await headers()
  const origin = headersList.get('origin')

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${origin}/auth/callback`,
    },
  })

  if (error || !data.url) {
    redirect('/sign-in?error=oauth_failed')
  }

  redirect(data.url)
}

export async function signOut() {
  const supabase = await createClient()
  const { error } = await supabase.auth.signOut()
  if (error) {
    redirect('/sign-in?error=signout_failed')
  }
  redirect('/sign-in')
}
