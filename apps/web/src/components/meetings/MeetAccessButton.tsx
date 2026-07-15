import { Button } from "../ui/Button";

interface MeetAccessButtonProps {
  meetUrl: string | null;
}

export const MeetAccessButton = ({ meetUrl }: MeetAccessButtonProps) => {
  if (!meetUrl) {
    return (
      <p className="user-meetings__note">
        Link do encontro indisponível para esta visualização.
      </p>
    );
  }

  return (
    <Button href={meetUrl} rel="noreferrer" target="_blank">
      Entrar no Google Meet
    </Button>
  );
};
