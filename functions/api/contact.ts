import { handleContact, type ContactEnv } from "../../src/api/contact";

export const onRequestPost: PagesFunction<ContactEnv> = ({ request, env }) =>
  handleContact(request, env);
