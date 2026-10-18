import { startTransition, type FormEvent } from "react";

// React 19는 <form action>이 끝나면 폼 칸을 처음 값(defaultValue/defaultChecked)으로 되돌린다.
// 칸 값을 useState로 관리하는 폼은 화면과 상태가 어긋나므로(예: 저장한 뒤 완독 체크가 풀려 보임)
// action 대신 이 함수로 제출한다. useActionState의 dispatch를 그대로 넘기면 된다.
export function submitKeepingInputs(dispatch: (data: FormData) => void) {
  return (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => dispatch(data));
  };
}
