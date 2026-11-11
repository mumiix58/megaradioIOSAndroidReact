import {useMemo} from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { fetchDirectoryPage, nextDirectoryPage, mergeDirectoryPages, DIRECTORY_PAGE_SIZE } from '../services/publicDirectoryService';
export function usePublicDirectory() {
  const query = useInfiniteQuery({
    queryKey: ['public-directory-v2'], initialPageParam: 1,
    queryFn: ({ pageParam,signal }) => fetchDirectoryPage(pageParam,signal),
    getNextPageParam: nextDirectoryPage, staleTime: 60000, gcTime:15*60*1000,retry:1,
  });
  const pages = query.data?.pages || [];
  const profiles = useMemo(()=>mergeDirectoryPages(query.data?.pages || []),[query.data?.pages]);
  const last = pages[pages.length - 1];
  const repeatedPage = pages.length > 1 && last?.rawCount >= DIRECTORY_PAGE_SIZE && nextDirectoryPage(last, pages) === undefined;
  return { ...query, profiles, repeatedPage };
}