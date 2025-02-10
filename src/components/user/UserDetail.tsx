import ImageCarousel from "../common/ImageCarousel";
import { UserType } from "./UserColumns";

type UserDetailProps = { currentUser: UserType | undefined };

export default function UserDetail({ currentUser }: UserDetailProps) {
  return (
    <section>
      <div className="p-4">{currentUser?.fullName}</div>
      <div className="place-self-center w-48">
        <ImageCarousel imageId="35050098" imageFolder="product" />
        <ImageCarousel imageId="35050118" imageFolder="product" />
        <ImageCarousel imageId="35050121" imageFolder="product" />
        <ImageCarousel imageId="35050127" imageFolder="product" />
      </div>
    </section>
  );
}
