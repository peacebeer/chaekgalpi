import type { Metadata } from "next";
import Link from "next/link";

import { LegalPage } from "@/components/legal/legal-page";
import { SITE } from "@/lib/site";
import { LIMITS } from "@/lib/validation/limits";

export const metadata: Metadata = { title: "이용약관 · 책갈피" };

const won = (value: number) => value.toLocaleString("ko-KR");

export default function TermsPage() {
  return (
    <LegalPage
      title="이용약관"
      summary="책갈피는 같은 책을 읽는 소그룹이 감상과 짧은 인용을 나누는 무료 비상업 서비스예요. 책 본문을 옮겨 싣지 않고, 서로를 존중해 주세요."
    >
      <section>
        <h2>1. 서비스</h2>
        <p>
          {SITE.name}은 개인이 운영하는 무료 비상업 프로젝트예요. 소그룹이 한
          권을 함께 읽으며 읽은 위치마다 인용과 감상을 나누는 공간을 제공해요.
          책 본문, 전자책, 페이지 사진은 제공하지도 받지도 않아요.
        </p>
      </section>

      <section>
        <h2>2. 가입</h2>
        <ul>
          <li>만 14세 이상이면 이메일이나 구글 계정으로 가입할 수 있어요.</li>
          <li>
            다른 사람의 이메일이나 계정으로 가입하면 안 되고, 내 계정은 내가
            관리해요.
          </li>
        </ul>
      </section>

      <section>
        <h2>3. 인용과 저작권</h2>
        <ul>
          <li>
            인용은 감상을 나누는 데 필요한 만큼만 해요. 카드 한 장에{" "}
            {won(LIMITS.quoteTextMax)}자, 그룹 전체에{" "}
            {won(LIMITS.groupQuoteLimit)}자까지 쓸 수 있고, 인용할 때는 내
            감상을 함께 적어야 해요.
          </li>
          <li>
            출처(책과 위치)는 자동으로 붙어요. 인용을 모아 본문을 옮기는 데 쓰면
            안 돼요.
          </li>
          <li>
            내가 쓴 감상의 권리는 나에게 있어요. 다만 그룹 회원에게 보여 주는 데
            필요한 범위에서 서비스가 저장하고 보여 줄 수 있어요.
          </li>
        </ul>
      </section>

      <section>
        <h2>4. 하면 안 되는 일</h2>
        <ul>
          <li>책 본문을 길게 옮기거나 불법 복제본을 나누는 일</li>
          <li>다른 회원을 비방·괴롭히거나 개인정보를 퍼뜨리는 일</li>
          <li>광고, 스팸, 서비스를 망가뜨리려는 자동 접속</li>
          <li>법령이나 다른 사람의 권리를 침해하는 일</li>
        </ul>
        <p>
          이런 글은 그룹 리더가 숨기거나 지울 수 있고, 운영자가 지우거나 이용을
          막을 수 있어요.
        </p>
      </section>

      <section>
        <h2>5. 그룹 리더</h2>
        <p>
          그룹을 만든 사람은 리더가 되어 그룹 정보를 고치고, 감상을 숨기고, 인용
          카드를 지우고, 회원을 내보낼 수 있어요. 리더는 이 권한을 그룹을 지키는
          데에만 써 주세요.
        </p>
      </section>

      <section>
        <h2>6. 서비스의 한계</h2>
        <ul>
          <li>
            개인 프로젝트라 예고 없이 점검·변경·종료될 수 있어요. 종료할 때는
            가능한 한 미리 알려요.
          </li>
          <li>
            저장한 글이 사라지지 않도록 노력하지만 완전히 보장하지는 못해요.
            중요한 글은 따로 보관해 주세요.
          </li>
          <li>회원끼리 나눈 글의 내용에 대한 책임은 쓴 사람에게 있어요.</li>
        </ul>
      </section>

      <section>
        <h2>7. 탈퇴와 개인정보</h2>
        <p>
          탈퇴는 문의 창구로 요청해 주세요. 개인정보를 어떻게 다루는지는{" "}
          <Link href="/privacy" className="underline">
            개인정보처리방침
          </Link>
          에 적어 두었어요.
        </p>
      </section>

      <section>
        <h2>8. 문의와 약관 변경</h2>
        <p>
          문의:{" "}
          <a
            href={SITE.contactUrl}
            className="underline"
            target="_blank"
            rel="noreferrer"
          >
            {SITE.contactLabel}
          </a>
          . 약관이 바뀌면 시행 7일 전부터 이 화면에 알려요.
        </p>
      </section>
    </LegalPage>
  );
}
