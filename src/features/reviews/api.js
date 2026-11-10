import { useMutation, useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';

/** Reviews a dispatcher has published, newest first. */
export function useApprovedReviews() {
  return useQuery({
    queryKey: ['reviews', 'approved'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reviews')
        .select('id, display_name, rating, comment, created_at')
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .limit(12);
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60_000,
  });
}

/**
 * Sends a review for moderation. `authorId` is the signed-in (possibly
 * anonymous) user; it is not shown until a dispatcher publishes the review.
 */
export function useSubmitReview() {
  return useMutation({
    mutationFn: async ({ authorId, displayName, rating, comment }) => {
      const { error } = await supabase.from('reviews').insert({
        author_id: authorId,
        display_name: displayName.trim() || 'Anonymous',
        rating,
        comment: comment.trim(),
      });
      if (error) throw error;
    },
  });
}
