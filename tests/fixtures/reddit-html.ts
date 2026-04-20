export const sampleRedditHTML = `
<!DOCTYPE html>
<html>
<head>
    <title>reddit: forhire</title>
</head>
<body>
    <div id="siteTable" class="sitetable linklisting">
        <div class="thing id-t3_abc123 odd link" data-fullname="t3_abc123">
            <span class="linkflairlabel">Hiring</span>
            <p class="title">
                <a class="title" href="/r/forhire/comments/abc123/hiring_nextjs_developer_for_remote_project/">
                    [Hiring] Next.js developer for remote project
                </a>
            </p>
            <div class="entry">
                <p class="tagline">
                    submitted <time title="Thu Sep 19 15:30:00 2025 UTC" datetime="2025-09-19T15:30:00+00:00">2 hours ago</time>
                    by <a href="/user/testuser" class="author">testuser</a>
                </p>
                <div class="score unvoted">42</div>
                <ul class="flat-list buttons">
                    <li class="first">
                        <a href="/r/forhire/comments/abc123/hiring_nextjs_developer_for_remote_project/" class="comments">15 comments</a>
                    </li>
                </ul>
                <div class="expando">
                    <div class="usertext-body">
                        Need a Next.js and TypeScript developer for a remote dashboard build.
                    </div>
                </div>
            </div>
        </div>
        
        <div class="thing id-t3_def456 even link" data-fullname="t3_def456">
            <p class="title">
                <a class="title" href="/r/forhire/comments/def456/looking_for_freelance_react_developer/">
                    Looking for freelance React developer
                </a>
            </p>
            <div class="entry">
                <p class="tagline">
                    submitted <time title="Thu Sep 19 14:00:00 2025 UTC" datetime="2025-09-19T14:00:00+00:00">3 hours ago</time>
                    by <a href="/user/clientuser" class="author">clientuser</a>
                </p>
                <div class="score unvoted">28</div>
                <ul class="flat-list buttons">
                    <li class="first">
                        <a href="/r/forhire/comments/def456/looking_for_freelance_react_developer/" class="comments">8 comments</a>
                    </li>
                </ul>
            </div>
        </div>

        <div class="thing id-t3_ghi789 odd link" data-fullname="t3_ghi789">
            <p class="title">
                <a class="title" href="https://example.com/job-posting">
                    We are Hiring - Senior Full Stack Engineer
                </a>
            </p>
            <div class="entry">
                <p class="tagline">
                    submitted <time title="Thu Sep 19 13:15:00 2025 UTC" datetime="2025-09-19T13:15:00+00:00">4 hours ago</time>
                    by <a href="/user/companyhr" class="author">companyhr</a>
                </p>
                <div class="score unvoted">156</div>
                <ul class="flat-list buttons">
                    <li class="first">
                        <a href="/r/forhire/comments/ghi789/we_are_hiring_senior_full_stack_engineer/" class="comments">42 comments</a>
                    </li>
                </ul>
            </div>
        </div>

        <div class="thing id-t3_jkl012 even link" data-fullname="t3_jkl012">
            <p class="title">
                <a class="title" href="/r/forhire/comments/jkl012/selling_my_old_laptop/">
                    [For Sale] Selling my old laptop
                </a>
            </p>
            <div class="entry">
                <p class="tagline">
                    submitted <time title="Thu Sep 19 12:00:00 2025 UTC" datetime="2025-09-19T12:00:00+00:00">5 hours ago</time>
                    by <a href="/user/seller123" class="author">seller123</a>
                </p>
                <div class="score unvoted">3</div>
                <ul class="flat-list buttons">
                    <li class="first">
                        <a href="/r/forhire/comments/jkl012/selling_my_old_laptop/" class="comments">1 comment</a>
                    </li>
                </ul>
            </div>
        </div>
    </div>
</body>
</html>
`;

export const expectedPosts = [
  {
    id: 'abc123',
    title: '[Hiring] Next.js developer for remote project',
    author: 'testuser',
    permalink:
      'https://www.reddit.com/r/forhire/comments/abc123/hiring_nextjs_developer_for_remote_project/',
    subreddit: 'forhire',
    score: 42,
    body: 'Need a Next.js and TypeScript developer for a remote dashboard build.',
    flair: 'Hiring',
    commentsCount: 15,
    createdUtc: new Date('2025-09-19T15:30:00+00:00').getTime() / 1000,
  },
  {
    id: 'def456',
    title: 'Looking for freelance React developer',
    author: 'clientuser',
    permalink:
      'https://www.reddit.com/r/forhire/comments/def456/looking_for_freelance_react_developer/',
    subreddit: 'forhire',
    score: 28,
    commentsCount: 8,
    createdUtc: new Date('2025-09-19T14:00:00+00:00').getTime() / 1000,
  },
  {
    id: 'ghi789',
    title: 'We are Hiring - Senior Full Stack Engineer',
    author: 'companyhr',
    permalink:
      'https://www.reddit.com/r/forhire/comments/ghi789/we_are_hiring_senior_full_stack_engineer/',
    subreddit: 'forhire',
    score: 156,
    commentsCount: 42,
    createdUtc: new Date('2025-09-19T13:15:00+00:00').getTime() / 1000,
    url: 'https://example.com/job-posting',
    outboundDomain: 'example.com',
  },
  {
    id: 'jkl012',
    title: '[For Sale] Selling my old laptop',
    author: 'seller123',
    permalink:
      'https://www.reddit.com/r/forhire/comments/jkl012/selling_my_old_laptop/',
    subreddit: 'forhire',
    score: 3,
    commentsCount: 1,
    createdUtc: new Date('2025-09-19T12:00:00+00:00').getTime() / 1000,
  },
];
