import {RpcService} from './pyy6kw6ods6vi0gy7yqys'

// ****************************************************
// CODE GENERATED BY TYPERPC ON 2020/6/24 at 14:47:50
// EDITING GENERATED CODE BY HAND IS HIGHLY DISCOURAGED,
// EDITING SCHEMAS AND REGENERATING CODE IS PREFERRED.
// TO REPORT A BUG, REQUEST A NEW FEATURE, OR OTHER
// ISSUES, VISIT https://github.com/g5becks/typeRPC/issues
// ****************************************************

export type Book = {
  publisher: string;
  releaseDate: Date;
}

export type Other = string | number | boolean

export type GetBooksByPublisherRequest = {
  publisher: string;
publisherName: string;

}

export type GetBooksReleasedBeforeRequest = {
  releaseDate: Date;

}

export type GetBooksByPublisherResponse = {
  data: Book[];
}

export type GetBooksReleasedBeforeResponse = {
  data: Date[];
}

export type PrintServiceResponse = {
  data: void;
}

export interface BookService  extends RpcService {
  getBooksByPublisher(publisher: string, publisherName: string): Promise<Book[]>;
  /**
   * GET
   *
   * @param {Date} releaseDate
   * @returns {Date[]}
   * @memberof BookService
   */
  getBooksReleasedBefore(releaseDate: Date): Promise<Date[]>;
}

export interface BookService2 extends RpcService {
  printService(): Promise<void>;
}
