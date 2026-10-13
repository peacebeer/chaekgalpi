// 두 회원 흐름 테스트에 쓰는 계정. 값은 환경 변수로만 받는다(코드에 적지 않는다).
// - 로컬: .env.local 에 적는다. 계정은 Supabase 대시보드에서 미리 만들어 둔다.
// - CI: 워크플로가 임시 로컬 Supabase용 값을 넣고, global-setup이 계정을 만든다.
export type E2EAccount = { email: string; password: string };

function read(prefix: "A" | "B"): E2EAccount | null {
  const email = process.env[`E2E_USER_${prefix}_EMAIL`];
  const password = process.env[`E2E_USER_${prefix}_PASSWORD`];
  return email && password ? { email, password } : null;
}

export function e2eAccounts(): { a: E2EAccount; b: E2EAccount } | null {
  const a = read("A");
  const b = read("B");
  return a && b ? { a, b } : null;
}
