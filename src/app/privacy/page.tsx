import type { Metadata } from "next";

import { LegalPage } from "@/components/legal/legal-page";
import { SITE } from "@/lib/site";

export const metadata: Metadata = { title: "개인정보처리방침 · 책갈피" };

export default function PrivacyPage() {
  return (
    <LegalPage
      title="개인정보처리방침"
      summary="책갈피는 로그인과 그룹 활동에 꼭 필요한 정보만 받아요. 광고나 판매에 쓰지 않고, 탈퇴를 요청하면 계정 정보를 지체 없이 지워요."
    >
      <section>
        <h2>1. 받는 정보</h2>
        <ul>
          <li>
            이메일로 가입할 때: 이메일 주소, 비밀번호(암호화해 저장하며 운영자도
            알 수 없어요), 닉네임
          </li>
          <li>
            구글로 로그인할 때: 구글 계정의 이메일 주소, 이름, 프로필 사진 주소
          </li>
          <li>직접 적을 때만: 활동 지역</li>
          <li>
            서비스를 쓰면서 생기는 정보: 만든·들어간 그룹, 읽은 진도, 인용
            카드·감상·답글·좋아요
          </li>
          <li>
            자동으로 남는 정보: 접속 IP 주소, 접속 시각, 브라우저 정보 같은 서버
            기록(오류를 찾고 악용을 막는 데에만 써요)
          </li>
        </ul>
      </section>

      <section>
        <h2>2. 쓰는 목적</h2>
        <ul>
          <li>회원 확인과 로그인 유지</li>
          <li>
            그룹 회원에게 닉네임, 진도, 글을 보여 주고 진도에 따라 글을 열고
            잠그기
          </li>
          <li>앱 안 알림(내 글에 달린 감상·답글·좋아요) 보여 주기</li>
          <li>문의 응대, 오류 해결, 부정 이용 방지</li>
        </ul>
      </section>

      <section>
        <h2>3. 보관 기간과 파기</h2>
        <ul>
          <li>회원 정보는 탈퇴할 때까지 보관해요.</li>
          <li>
            탈퇴를 요청하면 계정(이메일·비밀번호), 프로필, 그룹 회원 정보,
            좋아요를 지체 없이 지워요.
          </li>
          <li>
            그룹에 남긴 인용 카드와 감상은 다른 회원의 대화가 이어져 있어 작성자
            표시 없이(&ldquo;나간 회원&rdquo;) 남아요. 함께 지우기를 원하면
            탈퇴를 요청할 때 알려 주세요.
          </li>
          <li>서버 기록은 서비스 제공 업체의 보관 기간이 지나면 지워져요.</li>
        </ul>
      </section>

      <section>
        <h2>4. 다른 곳에 주지 않아요</h2>
        <p>
          받은 정보를 다른 사람이나 회사에 팔거나 넘기지 않아요. 법령에 따라
          수사기관 등이 정해진 절차로 요구하는 경우만 예외예요.
        </p>
      </section>

      <section>
        <h2>5. 처리를 맡긴 곳</h2>
        <p>서비스를 운영하려고 아래 업체의 서버를 이용해요.</p>
        <ul>
          <li>Supabase: 회원 계정과 데이터 저장(서버 위치: 대한민국 서울)</li>
          <li>Vercel: 웹사이트 호스팅과 접속 기록(서버 위치: 미국 등)</li>
          <li>Google: 구글 로그인을 고른 경우의 본인 확인</li>
        </ul>
        <p>
          책 검색에 쓰는 카카오와 국립중앙도서관에는 검색어만 보내고 회원 정보는
          보내지 않아요.
        </p>
      </section>

      <section>
        <h2>6. 쿠키</h2>
        <p>
          로그인 상태를 유지하는 쿠키와, 알림을 마지막으로 확인한 시각을 적는
          쿠키만 써요. 광고·추적 쿠키는 쓰지 않아요. 브라우저에서 쿠키를 막으면
          로그인할 수 없어요.
        </p>
      </section>

      <section>
        <h2>7. 내 정보에 대한 권리</h2>
        <p>
          닉네임과 지역은 프로필 화면에서 직접 고칠 수 있어요. 내 정보 열람,
          정정, 삭제, 처리 정지와 탈퇴는 아래 문의 창구로 요청하면 지체 없이
          처리해요. 만 14세 미만은 가입할 수 없어요.
        </p>
      </section>

      <section>
        <h2>8. 개인정보 보호 책임자와 문의</h2>
        <p>
          책임자: {SITE.name} 운영자 · 문의:{" "}
          <a
            href={SITE.contactUrl}
            className="underline"
            target="_blank"
            rel="noreferrer"
          >
            {SITE.contactLabel}
          </a>
        </p>
        <p className="text-muted-foreground">
          개인정보 침해 신고나 상담은 개인정보침해신고센터(국번 없이 118,
          privacy.kisa.or.kr)에도 할 수 있어요.
        </p>
      </section>

      <section>
        <h2>9. 바뀔 때</h2>
        <p>이 방침이 바뀌면 시행 7일 전부터 이 화면에 알려요.</p>
      </section>
    </LegalPage>
  );
}
