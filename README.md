# Next Elasticsearch Tools [![CircleCI](https://circleci.com/gh/Financial-Times/n-es-tools.svg?style=svg)](https://circleci.com/gh/Financial-Times/n-es-tools)

A useful CLI for working with Next's Elasticsearch clusters. Includes tools to snapshot and restore indexes.

## Prerequisites

- Node version defined by `engines.node` in `package.json`. Run command `nvm use` to switch your local Node version to the one specified in `.nvmrc`.
- [Vault CLI](https://github.com/Financial-Times/vault/wiki/Getting-Started#login-with-the-cli) (optional, see notes below)

## Installation and setup

You can install the tool from NPM by running the following command:

```
$ npm i -g @financial-times/n-es-tools
```

This will create a new folder in your home directory containing a single `config.yml` file. The tool requires several configuration settings which _must to be added to this file_ in order to use it.

**Note:** By default the tool assumes that you have the [Vault CLI](https://github.com/Financial-Times/vault/wiki/Getting-Started#login-with-the-cli) installed and are logged in. It will attempt to download and apply the required configuration settings automatically. This may be skipped using the `--skip-config` flag when running install manually.

## Usage

You can view the available commands and options by running:

```
$ n-es-tools --help
```

### Snapshotting and restoring an index

```sh
# set up a snapshot repository for the source cluster
$ n-es-tools repository eu -N transfers
> Repository "transfers" created (using the bucket "next-elasticsearch-eu-west-1-backups") for eu cluster

# set up a snapshot repository on the target cluster using the same S3 bucket
$ n-es-tools repository us -N transfers -B next-elasticsearch-eu-west-1-backups
> Repository "transfers" created (using the bucket "next-elasticsearch-eu-west-1-backups") for us cluster

# create a snapshot of the source index
$ n-es-tools snapshot eu -R transfers
> Snapshot "my-snapshot" created for "content_2017-12-04" index from eu cluster

# restore index to the target cluster (use actual name, not an alias)
$ n-es-tools restore us -R transfers -I content_2017-12-04
> Restored "my-snapshot" snapshot of "content_2017-12-04" index to us cluster
```

### Finding synchronisation problems

For issues caused by content published within the last 24 hours:

```sh
$ n-es-tools sync
```

For any issues caused by content published further back in time:

```sh
# fetch all UUIDs from each index
$ n-es-tools uuids eu
$ n-es-tools uuids us

# find differences between them and advise what to do
$ n-es-tools diff uuids-eu.txt uuids-us.txt
```

## Development

Here's the policy attached to the `next-es-tools` user that this tool authenticates as.

### AWS IAM User

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "AllowCloudFormationStackCreation",
            "Effect": "Allow",
            "Action": [
                "cloudformation:Create*",
                "cloudformation:Describe*",
                "cloudformation:EstimateTemplateCost",
                "cloudformation:ListStacks",
                "cloudformation:ValidateTemplate"
            ],
            "Resource": "*"
        },
        {
            "Sid": "AllowCloudFormationStackDeletion",
            "Effect": "Allow",
            "Action": [
                "cloudformation:DeleteStack"
            ],
            "Resource": [
                "arn:aws:cloudformation:::stack/next-content-*"
            ]
        },
        {
            "Sid": "AllowCloudFormationStackManagement",
            "Effect": "Allow",
            "Action": [
                "cloudformation:CancelUpdateStack",
                "cloudformation:ContinueUpdateRollback",
                "cloudformation:CreateChangeSet",
                "cloudformation:ExecuteChangeSet",
                "cloudformation:Get*",
                "cloudformation:List*",
                "cloudformation:PreviewStackUpdate",
                "cloudformation:SetStackPolicy",
                "cloudformation:SignalResource",
                "cloudformation:UpdateStack"
            ],
            "Resource": [
                "arn:aws:cloudformation:::stack/next-content-*",
                "arn:aws:cloudformation:::stack/nextcontent",
                "arn:aws:cloudformation:::stack/nextelasticdev"
            ]
        },
        {
            "Sid": "AllowNextContentElasticsearchDomainCreation",
            "Effect": "Allow",
            "Action": [
                "es:CreateElasticsearchDomain",
                "es:Describe*",
                "es:List*"
            ],
            "Resource": "*"
        },
        {
            "Sid": "AllowNextContentElasticsearchDomainDeletion",
            "Effect": "Allow",
            "Action": [
                "es:DeleteElasticsearchDomain"
            ],
            "Resource": [
                "arn:aws:es:::domain/next-content-*",
                "arn:aws:es:::domain/nextcontent",
                "arn:aws:es:::domain/nextelasticdev"
            ]
        },
        {
            "Sid": "AllowNextContentElasticsearchDomainManagement",
            "Effect": "Allow",
            "Action": [
                "es:AddTags",
                "es:RemoveTags",
                "es:UpdateElasticsearchDomainConfig"
            ],
            "Resource": [
                "arn:aws:es:::domain/next-content-*",
                "arn:aws:es:::domain/nextcontent",
                "arn:aws:es:::domain/nextelasticdev"
            ]
        },
        {
            "Sid": "AllowPassRoleForRepositoryCreation",
            "Effect": "Allow",
            "Action": "iam:PassRole",
            "Resource": "arn:aws:iam::027104099916:role/FTApplicationRoleFor_nextcontent"
        },
        {
            "Sid": "AllowKeyRotation",
            "Effect": "Allow",
            "Action": [
                "iam:CreateAccessKey",
                "iam:DeleteAccessKey",
                "iam:ListAccessKeys",
                "iam:UpdateAccessKey"
            ],
            "Resource": "arn:aws:iam:::user/${aws:username}"
        }
    ]
}
```

### Fixing authorisation issues

Rotating AWS keys means that eventually the `access_key` stored at `~/.n-es-tools/config.yml` will become outdated, meaning that you will see something like the following message:

```
<TASK> failed: Authorization Exception :: {"path":"/content/item/_search","query":{"sort":"_doc","scroll":"1m","size":5000,"_source":"false"},"statusCode":403,"response":"{\"message\":\"The security token included in the request is invalid.\"}"}
```

Reinstalling `n-es-tools` will pull in the current `access_key` and should address this issue.
