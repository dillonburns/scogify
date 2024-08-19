import {
  Box,
  Card,
  Layout,
  Link,
  List,
  Page,
  Text,
  BlockStack,
  Button,
  InlineStack,
  TextField,
  Bleed,
  Tag,
  Image,
  Select,
} from "@shopify/polaris";
import { useCallback, useEffect, useState } from "react";
import {
  getDiscogsReleaseId,
  isDiscogsReleaseUrl,
  fetchDiscogsRelease,
} from "~/utils";
import { Release as DiscogsRelease } from "~/types";
import { useActionData, Form } from "@remix-run/react";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { json, ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "~/shopify.server";

const DiscogsConditions = [
  { label: "Mint (M)", value: "M" },
  { label: "Near Mint (NM)", value: "NM" },
  { label: "Very Good (VG)", value: "VG" },
  { label: "Good (G)", value: "G" },
  { label: "Fair (F)", value: "F" },
  { label: "Poor (P)", value: "P" },
];

const ProductStatuses = ["Draft", "Active"];

type DiscogsConditionValue = (typeof DiscogsConditions)[number]["value"];

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();

  // Example formData extraction
  const title = formData.get("title");
  const descriptionHtml = formData.get("descriptionHtml");
  const tags = formData
    .get("tags")
    ?.split(",")
    ?.map((tag) => tag.trim())
    ?.filter((item) => item !== "");
  const imageUris = formData
    .get("imageUris")
    ?.split(",")
    ?.filter((item) => item !== "");
  const media = imageUris.map((imageUri) => {
    return {
      originalSource: imageUri,
      mediaContentType: "IMAGE",
    };
  });
  const sleeveCondition = formData.get("sleeveCondition");
  const mediaCondition = formData.get("mediaCondition");
  const musicGenre = formData.get("musicGenre");
  const discogsUrl = formData.get("discogsUrl");
  const status = formData.get("status").toUpperCase();
  const metafields = [
    {
      namespace: "custom",
      key: "sleeve_condition",
      type: "single_line_text_field",
      value: sleeveCondition,
    },
    {
      namespace: "custom",
      key: "media_condition",
      type: "single_line_text_field",
      value: mediaCondition,
    },
    {
      namespace: "custom",
      key: "discogs_url",
      type: "single_line_text_field",
      value: discogsUrl,
    },
    {
      namespace: "custom",
      key: "music_genre",
      type: "single_line_text_field",
      value: musicGenre,
    },
  ];

  const response = await admin.graphql(
    `#graphql
      mutation CreateProductWithNewMedia($input: ProductInput!, $media: [CreateMediaInput!]) {
        productCreate(input: $input, media: $media) {
          product {
            id
            title
            media(first: 10) {
              nodes {
                alt
                mediaContentType
                preview {
                  status
                }
              }
            }
          }
        }
      }`,
    {
      variables: {
        input: {
          title,
          descriptionHtml,
          tags,
          status,
          metafields,
        },
        media: media,
      },
    },
  );

  const responseJson = await response.json();

  return json({
    product: responseJson!.data!.productCreate!.product,
  });
};

export default function AddProduct() {
  const actionData = useActionData<typeof action>();
  const shopify = useAppBridge();

  const productId = actionData?.product?.id;

  useEffect(() => {
    if (productId) {
      shopify.toast.show("Product created");
    }
  }, [productId, shopify]);

  const [searchQuery, setSearchQuery] = useState(
    "https://www.discogs.com/release/27681219-Alice-Coltrane-Turiya-Sings",
  );
  const [searchResults, setSearchResults] = useState<DiscogsRelease>();

  const [shopifyProductMusicGenre, setShopifyProductMusicGenre] = useState("");
  const [sleeveCondition, setSleeveCondition] =
    useState<DiscogsConditionValue>();
  const [mediaCondition, setMediaCondition] = useState<DiscogsConditionValue>();

  const [shopifyProductTitle, setShopifyProductTitle] = useState("");
  const [shopifyProductDescription, setShopifyProductDescription] =
    useState("");

  const [shopifyProductStatus, setShopifyProductStatus] =
    useState<(typeof ProductStatuses)[number]>();
  const [shopifyProductImageUris, setShopifyProductImageUris] = useState<
    string[]
  >([]);

  const [shopifyProductTags, setShopifyProductTags] = useState("");
  const [shopifyProductCollections, setShopifyProductCollections] = useState();
  const handleSleeveConditionChange = useCallback(
    (value: DiscogsConditionValue) => setSleeveCondition(value),
    [],
  );
  const handleMediaConditionChange = useCallback(
    (value: DiscogsConditionValue) => setMediaCondition(value),
    [],
  );

  const handleShopifyProductStatusChange = useCallback(
    (value: (typeof ProductStatuses)[number]) => setShopifyProductStatus(value),
    [],
  );

  const [createProductPayload, setCreateProductPayload] = useState({});

  const handleSearch = () => {
    const id = getDiscogsReleaseId(searchQuery)?.releaseId;

    if (id) {
      fetchDiscogsRelease(id, "USD")
        .then((results) => {
          setSearchResults(results);
          makeInitialShopifyProductData(results);
        })
        .catch((error) => {
          console.error(error);
        });
    }
  };

  const makeInitialShopifyProductData = (results: DiscogsRelease) => {
    setShopifyProductTitle(`${results.artists_sort} - ${results.title}`);
    setShopifyProductDescription(
      `${results.formats.map((format) => `${format.name} ${format?.text}`).join(" ")} ${results.released_formatted ? `\nReleased ${results.released_formatted}` : ""}`,
    );
    setShopifyProductTags(
      `${results.genres.map((genre) => `${genre.replaceAll(",", "")}`).join(", ")}, ${results.styles?.map((style) => `${style.replaceAll(",", "")}`).join(", ")}`,
    );
    setShopifyProductMusicGenre(results.genres[0]);

    setShopifyProductImageUris(
      results?.images?.[0].uri ? [results?.images?.[0].uri] : [],
    );
  };

  const makeProductCreatePayload = () => {
    const payload = {
      input: {
        title: shopifyProductTitle,
        descriptionHtml: `<div>${shopifyProductDescription}</div>`,
        metafields: [
          {
            namespace: "custom",
            key: "sleeve_condition",
            type: "single_line_text_field",
            value: sleeveCondition,
          },
          {
            namespace: "custom",
            key: "media_condition",
            type: "single_line_text_field",
            value: mediaCondition,
          },
          {
            namespace: "custom",
            key: "discogs_url",
            type: "single_line_text_field",
            value: searchQuery,
          },
          {
            namespace: "shopify",
            key: "music-genre",
            type: "single_line_text_field",
            value: shopifyProductMusicGenre,
          },
        ],
        tags: shopifyProductTags,
        status: shopifyProductStatus,
        seo: {
          description: shopifyProductDescription,
          title: shopifyProductTitle,
        },
      },
      media: shopifyProductImageUris.map((uri) => ({
        originalSource: uri,
        alt: "",
        mediaContentType: "IMAGE",
      })),
    };

    return payload;
  };

  // async function selectCollection() {
  //   const collections = await window.shopify.resourcePicker({
  //     type: "collection",
  //     multiple: true,
  //     action: "add", // customized action verb, either 'select' or 'add',
  //   });

  //   if (collections) {
  //     console.log({ collections });
  //     setShopifyProductCollections(
  //       collections.map((collection) => collection.title),
  //     );
  //   }
  // }

  const handleDiscogsImageClick = (imageUri: string) => {
    setShopifyProductImageUris([...shopifyProductImageUris, imageUri]);
  };

  const handleShopifyMediaClick = (imageUri: string) => {
    setShopifyProductImageUris((prevImageUris) =>
      prevImageUris.filter((uri) => uri !== imageUri),
    );
  };

  return (
    <Page>
      <TitleBar title="Add Product" />

      <Layout>
        <Layout.Section variant="fullWidth">
          <Card>
            <TextField
              label={
                <Text as="h2" variant="headingMd">
                  Discogs Release URL
                </Text>
              }
              value={searchQuery}
              onChange={setSearchQuery}
              autoComplete="off"
              placeholder="Paste Discogs Release URL"
              helpText={
                getDiscogsReleaseId(searchQuery)?.releaseId
                  ? `Release ID: ${getDiscogsReleaseId(searchQuery)?.releaseId}`
                  : searchQuery !== ""
                    ? `Invalid URL`
                    : ""
              }
              connectedRight={
                <Button
                  disabled={!isDiscogsReleaseUrl(searchQuery)}
                  onClick={handleSearch}
                >
                  Search
                </Button>
              }
            />
          </Card>
        </Layout.Section>
        {searchResults && (
          <>
            <Layout.Section variant="oneHalf">
              <BlockStack gap="200">
                <Text as="h2" variant="headingLg" alignment="center">
                  Discogs Release
                </Text>
                <Card roundedAbove="sm">
                  <InlineStack gap="200">
                    <Text as="h2" variant="headingMd">
                      Title
                    </Text>
                    <Tag>{searchResults.title ?? "N/A"}</Tag>
                  </InlineStack>
                </Card>
                <Card roundedAbove="sm">
                  <InlineStack gap="200">
                    <Text as="h2" variant="headingMd">
                      Artist(s)
                    </Text>
                    {searchResults?.artists?.map((artist) => (
                      <Tag>{artist.name}</Tag>
                    )) ?? "N/A"}
                  </InlineStack>
                </Card>
                <Card roundedAbove="sm">
                  <InlineStack gap="200">
                    <Text as="h2" variant="headingMd">
                      Format
                    </Text>
                    {searchResults?.formats?.map((format) => (
                      <>
                        <Tag>{format.name}</Tag>
                        <Tag>{format?.text}</Tag>
                      </>
                    ))}
                    {searchResults?.formats?.map((format) =>
                      format?.descriptions?.map((description) => (
                        <Tag key={description}>{description}</Tag>
                      )),
                    )}
                  </InlineStack>
                </Card>
                <Card roundedAbove="sm">
                  <InlineStack gap="200">
                    <Text as="h2" variant="headingMd">
                      Release Date
                    </Text>
                    <Tag>{searchResults?.released_formatted}</Tag>
                  </InlineStack>
                </Card>
                <Card roundedAbove="sm">
                  <InlineStack gap="200">
                    <Text as="h2" variant="headingMd">
                      Genres & Styles
                    </Text>
                    {searchResults.genres.map((genre) => (
                      <Tag key={genre}>{genre}</Tag>
                    ))}
                    {searchResults.styles?.map((style) => (
                      <Tag key={style}>{style}</Tag>
                    ))}
                  </InlineStack>
                </Card>
                <Card roundedAbove="sm">
                  <InlineStack gap="200">
                    <Text as="h2" variant="headingMd">
                      Notes
                    </Text>
                    {searchResults?.notes}
                  </InlineStack>
                </Card>
                <Card roundedAbove="sm">
                  <InlineStack gap="500">
                    <Text as="h2" variant="headingMd" alignment="center">
                      Images
                    </Text>
                    {searchResults?.images?.length === 0 && (
                      <Tag>
                        <Text as="p">No Image</Text>
                      </Tag>
                    )}
                    {searchResults?.images?.map((image, index) => (
                      <Image
                        key={index}
                        onClick={() => {
                          handleDiscogsImageClick(image.uri);
                        }}
                        source={image.uri}
                        width={125}
                        alt={""}
                      />
                    ))}
                  </InlineStack>
                </Card>
              </BlockStack>
            </Layout.Section>
            <Layout.Section variant="oneHalf">
              <Form method="post">
                <BlockStack gap="200">
                  <Text as="h2" variant="headingLg" alignment="center">
                    Shopify Product
                  </Text>
                  <Card roundedAbove="sm">
                    <BlockStack gap="400">
                      <TextField
                        name={"title"}
                        label={"Title"}
                        value={shopifyProductTitle}
                        onChange={setShopifyProductTitle}
                        autoComplete="off"
                      />
                      <TextField
                        name={"descriptionHtml"}
                        label={"Description"}
                        value={shopifyProductDescription}
                        onChange={setShopifyProductDescription}
                        autoComplete="off"
                        multiline={4}
                      />
                      <Text as="p">Media</Text>
                      <InlineStack gap="200">
                        {shopifyProductImageUris.map((imageUri, index) => (
                          <Image
                            key={index}
                            source={imageUri}
                            width={125}
                            alt={""}
                            onClick={() => {
                              handleShopifyMediaClick(imageUri);
                            }}
                          />
                        ))}
                      </InlineStack>
                      <input
                        name="imageUris"
                        type="hidden"
                        value={shopifyProductImageUris.join(",")}
                      />
                    </BlockStack>
                  </Card>
                  <Card roundedAbove="sm">
                    <InlineStack gap="200">
                      <Text as="h2" variant="headingMd">
                        Status
                      </Text>
                      <Select
                        name={"status"}
                        label=""
                        options={ProductStatuses}
                        onChange={handleShopifyProductStatusChange}
                        value={shopifyProductStatus}
                      />
                    </InlineStack>
                  </Card>
                  <Card roundedAbove="sm">
                    <Box paddingBlockEnd="400">
                      <Text as="h2" variant="headingMd" alignment="center">
                        Metafields
                      </Text>
                    </Box>
                    <Bleed marginBlockEnd="400" marginInline="400">
                      <Box background="bg-surface-secondary" padding="400">
                        <BlockStack gap="200">
                          <TextField
                            name={"musicGenre"}
                            label={"Music Genre"}
                            value={shopifyProductMusicGenre}
                            onChange={setShopifyProductMusicGenre}
                            autoComplete="off"
                          />
                          <TextField
                            name={"discogsUrl"}
                            label={"Discogs URL"}
                            value={searchQuery}
                            onChange={() => {}}
                            autoComplete="off"
                            readonly
                          />
                          <Select
                            name="mediaCondition"
                            label="Media condition"
                            options={DiscogsConditions}
                            onChange={handleMediaConditionChange}
                            value={mediaCondition}
                          />
                          <Select
                            name="sleeveCondition"
                            label="Sleeve Condition"
                            options={DiscogsConditions}
                            onChange={handleSleeveConditionChange}
                            value={sleeveCondition}
                          />
                        </BlockStack>
                      </Box>
                    </Bleed>
                  </Card>
                  <Card roundedAbove="sm">
                    <Box paddingBlockEnd="400">
                      <Text as="h2" variant="headingMd" alignment="center">
                        Product organization
                      </Text>
                    </Box>
                    <Bleed marginBlockEnd="400" marginInline="400">
                      <Box background="bg-surface-secondary" padding="400">
                        <BlockStack gap="200">
                          <TextField
                            label={"Collections"}
                            value={shopifyProductCollections}
                            readonly
                            disabled
                            autoComplete="off"
                            connectedRight={<Button disabled>Select</Button>}
                          />
                          <TextField
                            name={"tags"}
                            label={"Tags"}
                            value={shopifyProductTags}
                            onChange={setShopifyProductTags}
                            autoComplete="off"
                            multiline={4}
                            maxHeight={100}
                          />
                        </BlockStack>
                      </Box>
                    </Bleed>
                  </Card>
                </BlockStack>
                <Button submit>Add Product</Button>
              </Form>
            </Layout.Section>
          </>
        )}
        <Layout.Section>
          <Card>
            <Text as="h2" variant="headingMd">
              productCreate Payload
            </Text>
            <Box
              padding="400"
              background="bg-surface-active"
              borderWidth="025"
              borderRadius="200"
              borderColor="border"
            >
              <pre style={{ margin: 0 }}>
                <code>{JSON.stringify({}, null, 2)}</code>
              </pre>
            </Box>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <Box
      as="span"
      padding="025"
      paddingInlineStart="100"
      paddingInlineEnd="100"
      background="bg-surface-active"
      borderWidth="025"
      borderColor="border"
      borderRadius="100"
    >
      <code>{children}</code>
    </Box>
  );
}
