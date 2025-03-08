// import ImageCarousel from "../common/ImageCarousel";
import UserHeader from "../common/UserHeader";
import { UserType } from "./UserColumns";

type UserDetailProps = { currentUser: UserType | undefined };

export default function UserDetail({ currentUser }: UserDetailProps) {
  return (
    <section className="flex flex-col gap-4 items-center mt-4">
      {currentUser && <UserHeader user={currentUser} size="h-48 w-48" />}

      <div className="p-4 text-xl">{currentUser?.fullName}</div>

      {/* <div className="place-self-center w-48">
        <ImageCarousel imageId="35050098" imageFolder="product" />
        <ImageCarousel imageId="35050118" imageFolder="product" />
        <ImageCarousel imageId="35050121" imageFolder="product" />
        <ImageCarousel imageId="35050127" imageFolder="product" />
      </div> */}
    </section>
  );
}
